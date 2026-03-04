#!/usr/bin/env python3
"""
Pipeline LBC : par région puis par tranche de prix 25k€.
Sortie : un fichier Parquet par région (data/region_<slug>.parquet).
Pas d'incrémental : on recrée les parquets à chaque run.
En fin : merge Parquet → SQLite, puis affichage durée + nombre de listings.
"""

import os
import sys
import time
import random
import sqlite3
from datetime import datetime

import lbc_scrape
from regions import REGIONS, DEPARTMENTS, region_slug

TARGET_TYPES = ["buy"]
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_FILE = os.path.join(DATA_DIR, "properties.db")
MAX_PER_SEARCH_OFFSET = 2500
PAGE_SIZE = 100
MAX_ADS_PER_SEARCH = 50_000

PROPERTY_KINDS_FULL = [
    ("apartment", "appartement"),
    ("house", "maison"),
]

# Tranches de 25k€
PRICE_RANGES_25K = [
    (p, p + 25_000) for p in range(0, 2_000_000, 25_000)
]


def write_parquet(rows: list[dict], path: str) -> None:
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError:
        raise RuntimeError("pyarrow requis pour le mode Parquet. Installez: pip install pyarrow")
    if not rows:
        return
    # Normaliser les types pour PyArrow (bool, None, str, int, float)
    def _row(r):
        out = {}
        for k, v in r.items():
            if v is None:
                out[k] = None
            elif isinstance(v, bool):
                out[k] = v
            elif isinstance(v, (int, float, str)):
                out[k] = v
            else:
                out[k] = str(v)
        return out
    normalized = [_row(r) for r in rows]
    table = pa.Table.from_pylist(normalized)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    pq.write_table(table, path)


def read_parquet(path: str) -> list[dict]:
    try:
        import pyarrow.parquet as pq
    except ImportError:
        raise RuntimeError("pyarrow requis. pip install pyarrow")
    if not os.path.isfile(path):
        return []
    table = pq.read_table(path)
    return table.to_pylist()


def merge_parquets_to_sqlite(conn) -> int:
    """Charge tous les Parquet de data/region_*.parquet dans la table properties. Retourne le total inséré."""
    # Ordre des colonnes aligné sur la table properties + region
    COLS = [
        "id", "source", "title", "price", "surface", "rooms", "city", "postalCode", "propertyKind",
        "listingType", "url", "imageUrl", "description", "scrapedAt", "pricePerSqm",
        "dpe", "ges", "charges", "floor", "hasElevator", "hasBalcony", "hasParking",
        "builtYear", "propertyTax", "isNew", "energyHeating", "heatingType",
        "bedrooms", "isFurnished", "hasCellar", "hasGarage", "terrain", "nbPhotos", "ownerType",
        "estimatedYield", "estimatedCashflow", "region",
    ]
    total = 0
    for region_name, dept_codes in REGIONS.items():
        slug = region_slug(region_name)
        path = os.path.join(DATA_DIR, f"region_{slug}.parquet")
        if not os.path.isfile(path):
            continue
        rows = read_parquet(path)
        if not rows:
            continue
        for r in rows:
            r["region"] = region_name
        placeholders = ",".join("?" for _ in COLS)
        col_list = ", ".join(COLS)
        for r in rows:
            vals = [r.get(c) for c in COLS]
            conn.execute(
                f"INSERT OR REPLACE INTO properties ({col_list}) VALUES ({placeholders})",
                vals,
            )
            total += 1
    conn.commit()
    return total


def ensure_region_column(conn) -> None:
    try:
        conn.execute("ALTER TABLE properties ADD COLUMN region TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # colonne déjà là
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_region ON properties(region)")
        conn.commit()
    except Exception:
        pass


def main() -> None:
    started_at = time.time()
    limit_regions = int(os.environ.get("PIPELINE_LIMIT_REGIONS", "0") or "0")  # 0 = toutes
    regions_items = list(REGIONS.items())
    if limit_regions > 0:
        regions_items = regions_items[:limit_regions]
        print(f"--> Limite: {limit_regions} région(s) (PIPELINE_LIMIT_REGIONS)")
    print("==================================================")
    print(f"[{datetime.now().isoformat()}] Pipeline — par région, tranches 25k€, sortie Parquet (full run)")
    print("==================================================")

    os.makedirs(DATA_DIR, exist_ok=True)

    for listing_type in TARGET_TYPES:
        for region_name, dept_codes in regions_items:
            slug = region_slug(region_name)
            print(f"\n>>> Région: {region_name} ({slug}) — {len(dept_codes)} départements × {len(PRICE_RANGES_25K)} tranches × {len(PROPERTY_KINDS_FULL)} types")
            region_props: list[dict] = []

            impersonate = random.choice(lbc_scrape.IMPERSONATE_OPTIONS)
            session = lbc_scrape.cf_requests.Session(impersonate=impersonate)

            for dept_code in dept_codes:
                dept_name = DEPARTMENTS.get(dept_code, dept_code)
                for kind_key, kind_label in PROPERTY_KINDS_FULL:
                    for price_min, price_max in PRICE_RANGES_25K:
                        if price_max > 2_000_000:
                            continue
                        total_fetched = 0
                        last_pivot = None
                        total_in_search = None
                        range_label = f"{price_min // 1000}k-{price_max // 1000}k€"

                        while total_fetched < MAX_ADS_PER_SEARCH:
                            batch_size = min(PAGE_SIZE, MAX_ADS_PER_SEARCH - total_fetched)
                            use_offset = total_fetched if not last_pivot else 0
                            if not last_pivot and total_fetched >= MAX_PER_SEARCH_OFFSET:
                                break
                            payload = lbc_scrape.build_payload(
                                city_key=None,
                                listing_type=listing_type,
                                kind=kind_key,
                                limit=batch_size,
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
                                print(f"    [!] {dept_code} {range_label}: {result['error']}", file=sys.stderr)
                                break
                            ads = result.get("ads") or []
                            if not ads:
                                break
                            if total_in_search is None and "total" in result:
                                total_in_search = result.get("total")
                            for ad in ads:
                                normalized = lbc_scrape.normalize_ad(ad, listing_type, city_label=dept_name)
                                if normalized:
                                    normalized["region"] = region_name
                                    region_props.append(normalized)
                            total_fetched += len(ads)
                            next_pivot = result.get("pivot")
                            if total_in_search is not None and total_fetched >= total_in_search:
                                break
                            if len(ads) < batch_size:
                                break
                            if next_pivot and next_pivot != last_pivot:
                                last_pivot = next_pivot
                            else:
                                last_pivot = None
                                if total_fetched >= MAX_PER_SEARCH_OFFSET:
                                    break
                            time.sleep(random.uniform(1.5, 3.0))

            parquet_path = os.path.join(DATA_DIR, f"region_{slug}.parquet")
            write_parquet(region_props, parquet_path)
            print(f"--- Région {region_name} terminée: {len(region_props)} annonces → {parquet_path}")

    # Merge Parquet → SQLite pour le site
    print("\n--> Merge Parquet → SQLite...")
    conn = lbc_scrape.init_db(DB_FILE)
    ensure_region_column(conn)
    # Vide la table puis re-remplit depuis les parquets (full run, pas d'incrémental)
    conn.execute("DELETE FROM properties")
    conn.commit()
    total_inserted = merge_parquets_to_sqlite(conn)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM properties")
    final_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT id) FROM properties")
    distinct_count = cursor.fetchone()[0]
    conn.close()

    elapsed = time.time() - started_at
    minutes, secs = int(elapsed // 60), int(elapsed % 60)

    print("\n==================================================")
    print(f"[{datetime.now().isoformat()}] Pipeline terminée")
    print(f"Durée totale: {minutes} min {secs} s")
    print(f"Listings en base: {final_count}")
    print(f"Annonces distinctes: {distinct_count}")
    print("==================================================")


if __name__ == "__main__":
    main()
