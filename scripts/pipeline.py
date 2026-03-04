#!/usr/bin/env python3
"""
Daily LBC Scraping Pipeline
This script is designed to run automatically every day to keep the properties.db 
database up to date with the latest listings.
It now dynamically fetches departments from the Geo API.
"""

import os
import sys
import time
import random
from datetime import datetime
import requests
import lbc_scrape

TARGET_TYPES = ["buy"]
DB_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "properties.db")
# L'API LBC limite l'offset à ~2500. On utilise la pagination par pivot (curseur) pour dépasser
# cette limite, comme https://github.com/thomasync/leboncoin-api-search (searchMultiples).
MAX_PER_SEARCH_OFFSET = 2500   # plafond si on n'utilise que l'offset
PAGE_SIZE = 100
# Cap par recherche (dépt × tranche × type) pour éviter boucles infinies si l'API renvoie toujours un pivot
MAX_ADS_PER_SEARCH = 50_000

# Type de bien (comme sur leboncoin "Type de bien") — 2 recherches par tranche de prix pour dépasser 2500/dépt.
PROPERTY_KINDS_FULL = [
    ("apartment", "appartement"),
    ("house", "maison"),
]

# Tranches de prix (€) — plus de tranches = plus de requêtes et plus d’annonces récupérées au total
PRICE_RANGES = [
    (0, 50_000),
    (50_000, 100_000),
    (100_000, 150_000),
    (150_000, 200_000),
    (200_000, 280_000),
    (280_000, 350_000),
    (350_000, 450_000),
    (450_000, 550_000),
    (550_000, 700_000),
    (700_000, 900_000),
    (900_000, 1_200_000),
    (1_200_000, 1_800_000),
    (1_800_000, 50_000_000),
]

def fetch_geo_data():
    """Fetches all departments from the Geo API."""
    print("--> Fetching administrative data from geo.api.gouv.fr...")
    try:
        depts_resp = requests.get("https://geo.api.gouv.fr/departements", timeout=10)
        depts_resp.raise_for_status()
        depts = depts_resp.json()
        dept_codes = [d['code'] for d in depts]
        return dept_codes
    except Exception as e:
        print(f"[!] Error fetching Geo API: {e}")
        return ["75", "69", "13", "31", "06", "44", "34", "67", "33", "59"]

def main() -> None:
    print("==================================================")
    print(f"[{datetime.now().isoformat()}] Starting Daily Immo Pipeline (Dynamic Geo)")
    print("==================================================")

    dept_codes = fetch_geo_data()
    print(f"--> Discovered {len(dept_codes)} departments.")

    conn = lbc_scrape.init_db(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM properties")
    initial_count = cursor.fetchone()[0]

    total_added_global = 0
    total_dupes_global = 0

    for listing_type in TARGET_TYPES:
        for dept in dept_codes:
            print(f"\n>>> DEPT {dept} ({listing_type.upper()}) — {len(PRICE_RANGES)} tranches × {len(PROPERTY_KINDS_FULL)} types")
            dept_added = 0
            dept_dupes = 0

            impersonate = random.choice(lbc_scrape.IMPERSONATE_OPTIONS)
            session = lbc_scrape.cf_requests.Session(impersonate=impersonate)

            for kind_key, kind_label in PROPERTY_KINDS_FULL:
                for price_min, price_max in PRICE_RANGES:
                    total_fetched = 0
                    last_pivot = None
                    total_in_search = None
                    range_label = f"{kind_label[:4]} {price_min // 1000}k-{price_max // 1000}k€" if price_max < 50_000_000 else f"{kind_label[:4]} >{price_min // 1_000_000}M€"

                    while total_fetched < MAX_ADS_PER_SEARCH:
                        batch_size = min(PAGE_SIZE, MAX_ADS_PER_SEARCH - total_fetched)
                        # Use pivot if we have one (cursor pagination); else use offset (limited to 2500 by API)
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
                            department_code=dept,
                            owner_type="all",
                            pivot=last_pivot,
                        )

                        result = lbc_scrape.scrape_page(session, payload)
                        if "error" in result:
                            print(f"    [!] {range_label}: {result['error']}")
                            break

                        ads = result.get("ads") or []
                        if not ads:
                            break

                        if total_in_search is None and "total" in result:
                            total_in_search = result.get("total")

                        batch_props = []
                        for ad in ads:
                            normalized = lbc_scrape.normalize_ad(ad, listing_type, city_label=f"Dép. {dept}")
                            if normalized:
                                batch_props.append(normalized)

                        if batch_props:
                            added, dupes = lbc_scrape.save_to_db(conn, batch_props)
                            dept_added += added
                            dept_dupes += dupes
                            print(f"    {range_label} n={total_fetched + len(ads)}: +{len(batch_props)} (dépt: {dept_added + dept_dupes})", file=sys.stderr)

                        total_fetched += len(ads)
                        next_pivot = result.get("pivot")

                        if total_in_search is not None and total_fetched >= total_in_search:
                            break
                        if len(ads) < batch_size:
                            break
                        # Pivot-based: continue with cursor if API returns a new pivot
                        if next_pivot and next_pivot != last_pivot:
                            last_pivot = next_pivot
                        else:
                            # No pivot: continue with offset until 2500 (API limit per search)
                            last_pivot = None
                            if total_fetched >= MAX_PER_SEARCH_OFFSET:
                                break

                        time.sleep(random.uniform(0.8, 1.8))

            total_added_global += dept_added
            total_dupes_global += dept_dupes
            print(f"--- Dept {dept} Finished: {dept_added} new, {dept_dupes} skipped.")

    # Call external scrapers for major cities
    import subprocess
    cities_to_scrape = ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse"]
    
    print("\n==================================================")
    print(">>> Starting External Scrapers (Bienveo & SeLoger)")
    print("==================================================")
    
    for city in cities_to_scrape:
        print(f"--> Scraping Bienveo for {city}")
        try:
            subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "bienveo_scrape.py"), "--city", city, "--type", "buy", "--db", DB_FILE], check=False)
        except Exception as e:
            print(f"Error running Bienveo: {e}")
            
        print(f"--> Scraping SeLoger for {city}")
        try:
            subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "seloger_scrape.py"), "--city", city, "--type", "buy", "--db", DB_FILE], check=False)
        except Exception as e:
            print(f"Error running SeLoger: {e}")

    cursor.execute("SELECT COUNT(*) FROM properties")
    final_count = cursor.fetchone()[0]
    total_new = final_count - initial_count
    
    conn.close()

    print("\n==================================================")
    print(f"[{datetime.now().isoformat()}] Pipeline Finished")
    print(f"Total new properties added today: {total_new}")
    print(f"Total database size: {final_count}")
    print("==================================================")

if __name__ == "__main__":
    main()
