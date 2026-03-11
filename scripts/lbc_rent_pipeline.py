#!/usr/bin/env python3
"""
Pipeline LBC Locations : scrape toutes les annonces de location (appartements + maisons)
par département, insertion incrémentale dans properties.db (ne supprime pas les buy/bienveo).

Utilisation :
    python scripts/lbc_rent_pipeline.py                    # tous les depts
    python scripts/lbc_rent_pipeline.py --depts 75,69,13   # depts ciblés
    python scripts/lbc_rent_pipeline.py --limit 50         # max annonces/dept

Prérequis : pip install curl_cffi
"""

import os
import sys
import time
import random
import argparse
from datetime import datetime

import lbc_scrape
from regions import REGIONS, DEPARTMENTS

DATA_DIR  = os.path.join(os.path.dirname(__file__), "..", "data")
DB_FILE   = os.path.join(DATA_DIR, "properties.db")

# Tranches de loyer pour contourner le plafond de 100 résultats par requête
# (loyers mensuels, en €)
RENT_PRICE_RANGES = [
    (0,    600),
    (600,  900),
    (900,  1200),
    (1200, 1600),
    (1600, 2200),
    (2200, 3500),
    (3500, 10000),
]

MAX_ADS_PER_RANGE = 200   # limite par tranche (anti-ban)
PAGE_SIZE         = 100


def scrape_dept_rent(session, dept_code: str, dept_name: str, limit_per_dept: int, conn) -> int:
    """Scrape les annonces de location pour un département, retourne le nombre ajouté."""
    total_added = 0
    consecutive_errors = 0
    BYPASS_AFTER_N_ERRORS = 3

    for price_min, price_max in RENT_PRICE_RANGES:
        fetched = 0
        last_pivot = None
        total_in_search = None

        while fetched < MAX_ADS_PER_RANGE:
            batch = min(PAGE_SIZE, MAX_ADS_PER_RANGE - fetched)
            use_offset = fetched if not last_pivot else 0

            payload = lbc_scrape.build_payload(
                city_key=None,
                listing_type="rent",
                kind="both",
                limit=batch,
                offset=use_offset,
                min_price=price_min,
                max_price=price_max,
                min_surface=None,
                department_code=dept_code,
                owner_type="all",
                pivot=last_pivot,
            )

            result = lbc_scrape.scrape_page(session, payload)

            if "error" in result:
                consecutive_errors += 1
                print(f"    [!] {dept_code} {price_min}-{price_max}€ : {result['error']} (#{consecutive_errors})",
                      file=sys.stderr)
                if consecutive_errors >= BYPASS_AFTER_N_ERRORS:
                    print(f"    --> {BYPASS_AFTER_N_ERRORS} échecs: pause 45s + nouvelle session", file=sys.stderr)
                    time.sleep(45)
                    session = lbc_scrape.make_session()
                    consecutive_errors = 0
                break

            ads = result.get("ads") or []
            if not ads:
                break

            consecutive_errors = 0
            if total_in_search is None and "total" in result:
                total_in_search = result.get("total")

            props = []
            for ad in ads:
                n = lbc_scrape.normalize_ad(ad, "rent", city_label=dept_name)
                if n:
                    props.append(n)

            added, _ = lbc_scrape.save_to_db(conn, props)
            total_added += added
            fetched += len(ads)

            # Arrêt si limite globale dept atteinte
            if limit_per_dept > 0 and total_added >= limit_per_dept:
                return total_added

            if total_in_search is not None and fetched >= total_in_search:
                break
            if len(ads) < batch:
                break

            next_pivot = result.get("pivot")
            if next_pivot and next_pivot != last_pivot:
                last_pivot = next_pivot
            else:
                last_pivot = None
                if fetched >= 2500:
                    break

            time.sleep(random.uniform(1.5, 3.0))

    return total_added


def main():
    parser = argparse.ArgumentParser(description="Pipeline LBC locations par département")
    parser.add_argument("--depts", default="", help="Codes département séparés par virgule (ex: 75,69,13). Vide = tous.")
    parser.add_argument("--limit", type=int, default=0, help="Max annonces par département (0 = illimité)")
    parser.add_argument("--db", default=DB_FILE, help="Chemin vers la base SQLite")
    args = parser.parse_args()

    db_path = args.db
    limit_per_dept = args.limit

    # Départements cibles
    if args.depts:
        target_depts = [(d.strip(), DEPARTMENTS.get(d.strip(), d.strip())) for d in args.depts.split(",") if d.strip()]
    else:
        # Tous les départements (ordre par zone dense → périphérie)
        target_depts = [(code, name) for code, name in DEPARTMENTS.items()]

    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = lbc_scrape.init_db(db_path)

    # Ajouter colonne region si manquante
    for col, typ in [("region", "TEXT")]:
        try:
            conn.execute(f"ALTER TABLE properties ADD COLUMN {col} {typ}")
            conn.commit()
        except Exception:
            pass

    started_at = time.time()
    print("=" * 60)
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Pipeline LBC Locations")
    print(f"  {len(target_depts)} département(s), limit={limit_per_dept or '∞'}/dept")
    print("=" * 60)

    # Compter les locations déjà en base (pour affichage delta)
    existing_count = conn.execute("SELECT COUNT(*) FROM properties WHERE listingType='rent' AND source='leboncoin'").fetchone()[0]
    print(f"  Locations LBC déjà en base: {existing_count}\n")

    grand_total_added = 0
    session = lbc_scrape.make_session()

    for i, (dept_code, dept_name) in enumerate(target_depts, 1):
        print(f"[{i}/{len(target_depts)}] {dept_code} — {dept_name}", flush=True)
        added = scrape_dept_rent(session, dept_code, dept_name, limit_per_dept, conn)
        grand_total_added += added
        print(f"  → +{added} annonces (total nouvelles: {grand_total_added})")

        # Petite pause inter-département
        if i < len(target_depts):
            time.sleep(random.uniform(2.0, 4.0))

    elapsed = int(time.time() - started_at)
    final_count = conn.execute("SELECT COUNT(*) FROM properties WHERE listingType='rent' AND source='leboncoin'").fetchone()[0]
    conn.close()

    print("\n" + "=" * 60)
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Terminé en {elapsed//60}m{elapsed%60}s")
    print(f"  Nouvelles annonces de location ajoutées : {grand_total_added}")
    print(f"  Total locations LBC en base             : {final_count}")
    print("=" * 60)

    # Sortie JSON pour le site (même contrat que lbc_scrape.py)
    import json
    print(json.dumps({"count": grand_total_added, "total": final_count, "type": "rent"}))


if __name__ == "__main__":
    main()
