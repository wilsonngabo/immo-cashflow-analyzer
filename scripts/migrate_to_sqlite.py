#!/usr/bin/env python3
import json
import os
import sqlite3
import sys

def main():
    json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'properties.json')
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'properties.db')

    if not os.path.exists(json_path):
        print("No properties.json found.")
        sys.exit(0)

    print(f"Migrating {json_path} to {db_path}...")

    with open(json_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            print("Error parsing JSON:", e)
            sys.exit(1)

    conn = sqlite3.connect(db_path)
    
    # Same schema as lbc_scrape.py
    conn.execute('''
        CREATE TABLE IF NOT EXISTS properties (
            id TEXT PRIMARY KEY,
            source TEXT,
            title TEXT,
            price REAL,
            surface REAL,
            rooms INTEGER,
            city TEXT,
            postalCode TEXT,
            propertyKind TEXT,
            listingType TEXT,
            url TEXT,
            imageUrl TEXT,
            description TEXT,
            scrapedAt TEXT,
            pricePerSqm REAL,
            dpe TEXT,
            ges TEXT,
            charges REAL,
            floor INTEGER,
            hasElevator BOOLEAN,
            hasBalcony BOOLEAN,
            hasParking BOOLEAN,
            builtYear INTEGER,
            propertyTax REAL,
            isNew BOOLEAN,
            energyHeating TEXT,
            heatingType TEXT,
            bedrooms INTEGER,
            isFurnished BOOLEAN,
            hasCellar BOOLEAN,
            hasGarage BOOLEAN,
            terrain REAL,
            nbPhotos INTEGER
        )
    ''')
    
    query = '''
        INSERT OR REPLACE INTO properties (
            id, source, title, price, surface, rooms, city, postalCode, propertyKind,
            listingType, url, imageUrl, description, scrapedAt, pricePerSqm,
            dpe, ges, charges, floor, hasElevator, hasBalcony, hasParking,
            builtYear, propertyTax, isNew, energyHeating, heatingType,
            bedrooms, isFurnished, hasCellar, hasGarage, terrain, nbPhotos
        ) VALUES (
            :id, :source, :title, :price, :surface, :rooms, :city, :postalCode, :propertyKind,
            :listingType, :url, :imageUrl, :description, :scrapedAt, :pricePerSqm,
            :dpe, :ges, :charges, :floor, :hasElevator, :hasBalcony, :hasParking,
            :builtYear, :propertyTax, :isNew, :energyHeating, :heatingType,
            :bedrooms, :isFurnished, :hasCellar, :hasGarage, :terrain, :nbPhotos
        )
    '''
    
    # Ensure all missing keys exist in dictionaries
    default_keys = [
        "id", "source", "title", "price", "surface", "rooms", "city", "postalCode", "propertyKind",
        "listingType", "url", "imageUrl", "description", "scrapedAt", "pricePerSqm",
        "dpe", "ges", "charges", "floor", "hasElevator", "hasBalcony", "hasParking",
        "builtYear", "propertyTax", "isNew", "energyHeating", "heatingType",
        "bedrooms", "isFurnished", "hasCellar", "hasGarage", "terrain", "nbPhotos"
    ]
    
    formatted_data = []
    for row in data:
        filled_row = {k: row.get(k) for k in default_keys}
        formatted_data.append(filled_row)

    conn.executemany(query, formatted_data)
    conn.commit()
    conn.close()

    print(f"Migrated {len(formatted_data)} properties to SQLite successfully.")

if __name__ == '__main__':
    main()
