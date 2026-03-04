#!/usr/bin/env python3
"""
Bienveo (Social Housing) Scraper

Bienveo exposes listings of available social housing.
Usage:
    python scripts/bienveo_scrape.py --city Paris --limit 100 --type rent --db data/properties.db
"""

import os
import sys
import json
import argparse
import time
import sqlite3
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests not installed. Run: pip install requests"}), file=sys.stderr)
    sys.exit(1)

# Basic setup to reuse existing SQLite DB
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

# The Bienveo API endpoint
BIENVEO_API_URL = "https://www.bienveo.fr/api/search/search-properties"

def main():
    parser = argparse.ArgumentParser(description="Bienveo scraper")
    parser.add_argument("--city", default="Paris", help="Search string")
    parser.add_argument("--limit", type=int, default=100, help="Max ads")
    parser.add_argument("--type", default="rent", choices=["rent", "buy"]) # Bienveo is mostly rent, sometimes buy
    parser.add_argument("--db", default="data/properties.db")
    args = parser.parse_args()

    # If asking for buy but we only have rent or vice-versa
    operation = 1 if args.type == "buy" else 0 # 0 usually rent on Bienveo

    payload = {
        "operation": operation,
        "search": args.city,
        "page": 1,
        "limit": args.limit
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    print(f"Scraping Bienveo: search={args.city}, operation={operation}", file=sys.stderr)

    try:
        resp = requests.post(BIENVEO_API_URL, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    results = data.get("properties", [])
    if not results:
        results = data.get("data", []) # check alternative payload structures

    properties_to_save = []
    
    for item in results:
        # Map Bienveo fields to our schema
        prop_id = str(item.get("id", ""))
        if not prop_id: continue

        price = item.get("loyer") or item.get("prix")
        if not price: continue
        
        surface = item.get("surface")
        rooms = item.get("nb_pieces")
        city = item.get("ville", "")
        zipcode = item.get("code_postal", "")
        
        # Housing type
        kind_str = str(item.get("type_bien", "")).lower()
        property_kind = "apartment" if "appartement" in kind_str else "house" if "maison" in kind_str else "other"

        url = f"https://www.bienveo.fr/annonce/{prop_id}"
        
        images = item.get("photos", [])
        image_url = images[0] if images else ""

        description = item.get("description", "")
        
        dpe = item.get("dpe", "")
        ges = item.get("ges", "")
        
        charges = item.get("charges")
        floor = item.get("etage")

        has_elevator = bool(item.get("ascenseur"))
        has_parking = bool(item.get("parking"))
        has_balcony = bool(item.get("balcon"))
        
        title = item.get("titre") or f"{property_kind.title()} {rooms} pièces - {surface} m²"

        price_per_sqm = round(price / surface) if surface and price else None

        properties_to_save.append({
            "id": f"bie_{prop_id}",
            "source": "bienveo",
            "title": str(title)[:200],
            "price": float(price),
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
            "charges": float(charges) if charges else None,
            "floor": int(floor) if floor else None,
            "hasElevator": has_elevator,
            "hasBalcony": has_balcony,
            "hasParking": has_parking,
            "builtYear": None,
            "propertyTax": None,
            "isNew": False,
            "energyHeating": None,
            "heatingType": None,
            "bedrooms": max(1, (int(rooms) - 1)) if rooms else None,
            "isFurnished": False,
            "hasCellar": False,
            "hasGarage": False,
            "terrain": None,
            "nbPhotos": len(images) if isinstance(images, list) else 0,
            "ownerType": None,
        })

    conn = init_db(args.db)
    save_to_db(conn, properties_to_save)
    conn.close()

    print(json.dumps({
        "count": len(properties_to_save),
        "city": args.city,
        "type": args.type
    }))

if __name__ == "__main__":
    main()
