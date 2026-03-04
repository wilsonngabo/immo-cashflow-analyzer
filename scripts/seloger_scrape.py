#!/usr/bin/env python3
"""
SeLoger Scraper using curl_cffi for TLS browser impersonation.
Usage:
    python scripts/seloger_scrape.py --city Paris --limit 100 --type buy --db data/properties.db
"""

import os
import sys
import json
import argparse
import time
import random
import sqlite3
import re
from datetime import datetime, timezone

try:
    from curl_cffi import requests as cf_requests
except ImportError:
    print(json.dumps({"error": "curl_cffi not installed. Run: pip install curl_cffi"}), file=sys.stderr)
    sys.exit(1)

# City references (approx bounds/codes for demo)
CITIES = {
    "paris": "750115",
    "lyon": "690123", # Usually grouped or given by full insee codes
    "marseille": "130055",
}

IMPERSONATE_OPTIONS = ["chrome110", "chrome107", "firefox117", "edge101"]

def init_db(db_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def save_to_db(conn, properties):
    if not properties:
        return
    query = '''
        INSERT OR REPLACE INTO properties (
            id, source, title, price, surface, rooms, city, postalCode, propertyKind,
            listingType, url, imageUrl, description, scrapedAt, pricePerSqm,
            dpe, ges, charges, floor, hasElevator, hasBalcony, hasParking,
            builtYear, propertyTax, isNew, energyHeating, heatingType,
            bedrooms, isFurnished, hasCellar, hasGarage, terrain, nbPhotos, ownerType
        ) VALUES (
            :id, :source, :title, :price, :surface, :rooms, :city, :postalCode, :propertyKind,
            :listingType, :url, :imageUrl, :description, :scrapedAt, :pricePerSqm,
            :dpe, :ges, :charges, :floor, :hasElevator, :hasBalcony, :hasParking,
            :builtYear, :propertyTax, :isNew, :energyHeating, :heatingType,
            :bedrooms, :isFurnished, :hasCellar, :hasGarage, :terrain, :nbPhotos, :ownerType
        )
    '''
    conn.executemany(query, [dict(p, ownerType=p.get('ownerType')) for p in properties])
    conn.commit()

# NOTE: Since SeLoger's API endpoints require complex handshake/tokens often changing,
# this is a structured best-effort approach. If the endpoint is 403, we return an error gracefully.
# The user might need a residential proxy or bypass if Datadome gets too aggressive.

SELOGER_API_URL = "https://api-seloger.ws.seloger.com/api/v1/listings/search"

def main():
    parser = argparse.ArgumentParser(description="SeLoger scraper using curl_cffi")
    parser.add_argument("--city", default="Paris")
    parser.add_argument("--type", default="buy", choices=["buy", "rent"])
    parser.add_argument("--kind", default="both", choices=["apartment", "house", "both"])
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--min-price", type=int, default=None)
    parser.add_argument("--max-price", type=int, default=None)
    parser.add_argument("--min-surface", type=int, default=None)
    parser.add_argument("--db", default="data/properties.db")
    args = parser.parse_args()

    # Mappings
    transaction_type = 2 if args.type == "buy" else 1
    property_types = []
    if args.kind in ["apartment", "both"]: property_types.append(1)
    if args.kind in ["house", "both"]: property_types.append(2)

    city_key = args.city.lower()
    insee_code = CITIES.get(city_key, "750115") # fallback roughly

    payload: dict = {
        "projects": [transaction_type],
        "types": property_types,
        "places": [{"inseeCodes": [insee_code]}],
        "pageSize": min(args.limit, 50),
        "pageIndex": 1,
        "sortBy": 0, # date desc usually
    }

    if args.min_price or args.max_price:
        payload["price"] = {}
        if args.min_price: payload["price"]["min"] = args.min_price
        if args.max_price: payload["price"]["max"] = args.max_price
    if args.min_surface:
        payload["surface"] = {"min": args.min_surface}

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "origin": "https://www.seloger.com",
        "referer": "https://www.seloger.com/"
    }

    print(f"Scraping SeLoger: city={args.city}, type={args.type}", file=sys.stderr)

    session = cf_requests.Session(impersonate=random.choice(IMPERSONATE_OPTIONS))

    # Warmup
    try:
        session.get("https://www.seloger.com/", timeout=10)
        time.sleep(1)
    except:
        pass

    properties = []
    
    try:
        # We try touching the API
        resp = session.post(SELOGER_API_URL, json=payload, headers=headers, timeout=15)
        
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            for item in items:
                prop_id = item.get("id")
                if not prop_id: continue

                price = item.get("price")
                surface = item.get("livingArea")
                title = item.get("title", f"Annonce SeLoger {prop_id}")
                city = item.get("city", args.city)
                zipcode = item.get("zipCode", "")
                rooms = item.get("rooms")
                bedrooms = item.get("bedrooms")
                url = item.get("permalink", f"https://www.seloger.com/annonces/{prop_id}")
                
                photos = item.get("photos", [])
                image_url = photos[0] if photos else ""
                
                property_kind = "apartment" if item.get("propertyType") == 1 else "house" if item.get("propertyType") == 2 else "other"
                
                description = item.get("description", "")
                
                dpe = item.get("energyPerformanceValue")
                ges = item.get("ghgValue")

                price_per_sqm = round(price / surface) if price and surface else None

                properties.append({
                    "id": f"sl_{prop_id}",
                    "source": "seloger",
                    "title": title[:200],
                    "price": float(price) if price else None,
                    "surface": float(surface) if surface else None,
                    "rooms": int(rooms) if rooms else None,
                    "city": city.title(),
                    "postalCode": zipcode,
                    "propertyKind": property_kind,
                    "listingType": args.type,
                    "url": url,
                    "imageUrl": image_url,
                    "description": description,
                    "scrapedAt": datetime.now(timezone.utc).isoformat(),
                    "pricePerSqm": price_per_sqm,
                    "dpe": str(dpe) if dpe else None,
                    "ges": str(ges) if ges else None,
                    "charges": None,
                    "floor": None,
                    "hasElevator": False,
                    "hasBalcony": False,
                    "hasParking": False,
                    "builtYear": None,
                    "propertyTax": None,
                    "isNew": item.get("isNew", False),
                    "energyHeating": None,
                    "heatingType": None,
                    "bedrooms": int(bedrooms) if bedrooms else None,
                    "isFurnished": False,
                    "hasCellar": False,
                    "hasGarage": False,
                    "terrain": None,
                    "nbPhotos": len(photos) if isinstance(photos, list) else 0,
                    "ownerType": None,
                })
        else:
            print(json.dumps({"error": f"SeLoger API blocked or changed (HTTP {resp.status_code})"}), file=sys.stderr)
            
    except Exception as e:
        print(json.dumps({"error": f"SeLoger Exception: {str(e)}"}), file=sys.stderr)

    if properties:
        conn = init_db(args.db)
        save_to_db(conn, properties)
        conn.close()

    print(json.dumps({
        "count": len(properties),
        "city": args.city,
        "type": args.type
    }))

if __name__ == "__main__":
    main()
