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
MAX_PER_DEPT = 500  # Pull up to 500 ads per department

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
            print(f"\n>>> Scraping: DEPT {dept} ({listing_type.upper()})")
            
            impersonate = random.choice(lbc_scrape.IMPERSONATE_OPTIONS)
            session = lbc_scrape.cf_requests.Session(impersonate=impersonate)
            
            dept_properties = []
            offset = 0
            page_size = 35
            dept_added = 0
            dept_dupes = 0
            
            while len(dept_properties) < MAX_PER_DEPT:
                batch_size = min(page_size, MAX_PER_DEPT - len(dept_properties))
                payload = lbc_scrape.build_payload(
                    city_key=None,
                    listing_type=listing_type,
                    kind="both",
                    limit=batch_size,
                    offset=offset,
                    department_code=dept
                )

                result = lbc_scrape.scrape_page(session, payload)
                if "error" in result:
                    print(f"    [!] Error (Dept {dept}): {result['error']}")
                    break

                ads = result.get("ads") or []
                if not ads:
                    break

                batch_props = []
                for ad in ads:
                    normalized = lbc_scrape.normalize_ad(ad, listing_type, city_label=f"Dép. {dept}")
                    if normalized:
                        batch_props.append(normalized)

                if batch_props:
                    added, dupes = lbc_scrape.save_to_db(conn, batch_props)
                    dept_added += added
                    dept_dupes += dupes
                    dept_properties.extend(batch_props)
                    print(f"    + Batch: {len(batch_props)} ads (Added: {added}, Dupes: {dupes})")
                
                offset += len(ads)
                if len(ads) < batch_size:
                    break
                
                time.sleep(random.uniform(1, 2))

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
