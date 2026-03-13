#!/usr/bin/env python3
"""
LeBonCoin scraper using curl_cffi for TLS browser impersonation (cost-efficient, bypasses many bot checks).
Based on: https://github.com/etienne-hd/lbc
Pagination: https://github.com/thomasync/leboncoin-api-search
Refs: https://www.reddit.com/r/webscraping/comments/1co6a3g/ | https://curl-cffi.readthedocs.io/

Usage:
    python scripts/lbc_scrape.py --city Paris --limit 100 --type buy --db data/properties.db
    LBC_PROXY=http://user:pass@host:port python scripts/lbc_scrape.py ...  # optional proxy
"""

import os
import sys
import json
import argparse
import time
import random
import re
from datetime import datetime, timezone

# Ensure scripts/ is in path for shared import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from curl_cffi import requests as cf_requests
except ImportError:
    print(json.dumps({"error": "curl_cffi not installed. Run: pip install curl_cffi"}))
    sys.exit(1)

# ─── City coordinates (for radius-based search) ──────────────────────────────

CITIES = {
    "paris":      {"lat": 48.8566, "lng": 2.3522,  "label": "Paris"},
    "lyon":       {"lat": 45.7640, "lng": 4.8357,  "label": "Lyon"},
    "marseille":  {"lat": 43.2965, "lng": 5.3698,  "label": "Marseille"},
    "bordeaux":   {"lat": 44.8378, "lng": -0.5792, "label": "Bordeaux"},
    "toulouse":   {"lat": 43.6047, "lng": 1.4442,  "label": "Toulouse"},
    "nice":       {"lat": 43.7102, "lng": 7.2620,  "label": "Nice"},
    "nantes":     {"lat": 47.2184, "lng": -1.5536, "label": "Nantes"},
    "rennes":     {"lat": 48.1173, "lng": -1.6778, "label": "Rennes"},
    "strasbourg": {"lat": 48.5734, "lng": 7.7521,  "label": "Strasbourg"},
    "montpellier":{"lat": 43.6108, "lng": 3.8767,  "label": "Montpellier"},
    "lille":      {"lat": 50.6292, "lng": 3.0573,  "label": "Lille"},
}

CATEGORY_BUY  = "9"
CATEGORY_RENT = "10"

REAL_ESTATE_APARTMENT = ["2"]
REAL_ESTATE_HOUSE     = ["1"]
REAL_ESTATE_ALL       = ["1", "2"]

LBC_API_URL = "https://api.leboncoin.fr/finder/search"
# Fetch single ad by id (same as https://github.com/thomasync/leboncoin-api-search searchById)
LBC_ADFINDER_URL = "https://api.leboncoin.fr/api/adfinder/v1/myads"

from shared.session import make_session
from shared.db import init_db, save_to_db


def build_payload(city_key: str | None, listing_type: str, kind: str, limit: int,
                  offset: int, min_price: int | None, max_price: int | None,
                  min_surface: int | None, radius_m: int = 10_000, 
                  department_code: str | None = None,
                  owner_type: str = "all", pivot: str | None = None) -> dict:
    city = CITIES.get((city_key or "").lower(), CITIES["paris"])

    category = CATEGORY_BUY if listing_type == "buy" else CATEGORY_RENT
    real_estate_type = (
        REAL_ESTATE_APARTMENT if kind == "apartment"
        else REAL_ESTATE_HOUSE if kind == "house"
        else REAL_ESTATE_ALL  # "both" ou autre
    )

    enums: dict = {
        "ad_type": ["offer"],
        "real_estate_type": real_estate_type,
    }
    # Explicitly request both pro and particulier (do not filter by ad_owner_type when "all")
    if owner_type == "private":
        enums["ad_owner_type"] = ["private"]
    elif owner_type == "professional":
        enums["ad_owner_type"] = ["professional"]
    # else "all" -> no ad_owner_type filter, API returns both

    # Pivot-based pagination (cursor) can go past the ~2500 offset limit (see leboncoin-api-search)
    payload: dict = {
        "filters": {
            "category": {"id": category},
            "enums": enums,
        },
        "limit": min(limit, 100),
        "limit_alu": 0,
        "disable_total": False,
        "extend": True,
        "listing_source": "direct-search" if (offset == 0 and not pivot) else "pagination",
        "sort_by": "time",
        "sort_order": "desc",
    }
    if pivot:
        payload["pivot"] = pivot
    else:
        payload["offset"] = offset
    
    if department_code:
        payload["filters"]["location"] = {
            "departments": [department_code]
        }
    elif city_key and city_key.lower() != "france":
        payload["filters"]["location"] = {
            "locations": [{
                "area": {
                    "lat": city["lat"],
                    "lng": city["lng"],
                    "radius": radius_m,
                },
                "city": city["label"],
                "label": f"{city['label']} (toute la ville)",
                "locationType": "city",
            }]
        }

    ranges: dict = {}
    if min_price is not None or max_price is not None:
        price_range: dict = {}
        if min_price is not None:
            price_range["min"] = min_price
        if max_price is not None:
            price_range["max"] = max_price
        ranges["price"] = price_range
    if min_surface is not None:
        ranges["square"] = {"min": min_surface}
    if ranges:
        payload["filters"]["ranges"] = ranges

    return payload


def extract_attr(attrs: list[dict], key: str, prefer_label: bool = False) -> str | None:
    for a in (attrs or []):
        if a.get("key") == key:
            if prefer_label and "value_label" in a:
                return str(a["value_label"])
            v = a.get("value")
            if isinstance(v, list):
                return str(v[0]) if v else None
            return str(v) if v is not None else None
    return None

def parse_float(s: str | None) -> float | None:
    if not s: return None
    m = re.search(r"[\d\.,]+", str(s))
    if m:
        try:
            return float(m.group(0).replace(",", "."))
        except ValueError:
            return None
    return None

def parse_int(s: str | None) -> int | None:
    if not s: return None
    m = re.search(r"-?\d+", str(s))
    if m:
        return int(m.group(0))
    return None

def scrape_page(session, payload: dict, retries: int = 3) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Origin": "https://www.leboncoin.fr",
        "Referer": "https://www.leboncoin.fr/",
    }

    for attempt in range(retries):
        try:
            if attempt == 0 and sum(1 for cookie in session.cookies) == 0:
                # Warm up session
                session.get("https://www.leboncoin.fr/", timeout=15)
                time.sleep(random.uniform(1.0, 2.0))

            resp = session.post(LBC_API_URL, json=payload, headers=headers, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 403:
                if attempt < retries - 1:
                    session.impersonate = random.choice(IMPERSONATE_OPTIONS)
                    time.sleep(3 + attempt * 3)
                    continue
                else:
                    return {"error": f"Blocked by Datadome (403) after {retries} attempts"}
            else:
                return {"error": f"HTTP {resp.status_code}"}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1.5)
                continue
            return {"error": str(e)}
    return {"error": "Max retries exceeded"}


def fetch_ad_by_id(session, list_id: int) -> dict | None:
    """Fetch a single ad by list_id (for import by URL). Same endpoint as leboncoin-api-search searchById."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Origin": "https://www.leboncoin.fr",
        "Referer": "https://www.leboncoin.fr/",
    }
    try:
        resp = session.post(LBC_ADFINDER_URL, json={"ids": [list_id]}, headers=headers, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return None
    except Exception:
        return None


def normalize_ad(ad: dict, listing_type: str, city_label: str | None) -> dict | None:
    attrs = ad.get("attributes") or []
    images_obj = ad.get("images") or {}
    images_urls = images_obj.get("urls") or []
    thumb = images_obj.get("thumb_url", "")
    
    # Use best quality image
    image_url = images_urls[0] if images_urls else thumb
    nb_photos = int(images_obj.get("nb_images") or len(images_urls))

    price_raw = ad.get("price") or []
    price = price_raw[0] if price_raw else None
    if not price:
        return None  

    surface_str = extract_attr(attrs, "square")
    surface = parse_float(surface_str)

    rooms_str = extract_attr(attrs, "rooms")
    rooms = parse_int(rooms_str)

    re_type_val = extract_attr(attrs, "real_estate_type")
    # LBC uses enum value for type directly in value_label sometimes, or we deduce
    property_kind = (
        "house" if (str(re_type_val) == "1" or str(re_type_val).lower() == "maison")
        else "apartment" if (str(re_type_val) == "2" or str(re_type_val).lower() == "appartement")
        else "other"
    )

    loc = ad.get("location") or {}
    city = loc.get("city") or city_label or ""
    zipcode = loc.get("zipcode") or ""

    ad_id = ad.get("list_id") or ad.get("id") or ""
    url = ad.get("url") or f"https://www.leboncoin.fr/ad/ventes_immobilieres/{ad_id}"

    price_per_sqm = round(price / surface) if surface and price else None

    dpe = extract_attr(attrs, "energy_rate", True)
    ges = extract_attr(attrs, "ges", True)
    
    charges_str = extract_attr(attrs, "charges")
    charges = parse_int(charges_str)
    
    floor_str = extract_attr(attrs, "floor_number")
    floor = parse_int(floor_str)
    
    has_elevator = str(extract_attr(attrs, "elevator")) in ["1", "Oui", "oui", "true"]
    has_balcony = str(extract_attr(attrs, "balkony")) in ["1", "Oui", "oui", "true"]
    has_parking = str(extract_attr(attrs, "parking")) in ["1", "Oui", "oui", "true"]
    
    built_year_str = extract_attr(attrs, "built_year")
    built_year = parse_int(built_year_str)
    
    property_tax_str = extract_attr(attrs, "property_tax")
    property_tax = parse_int(property_tax_str)
    
    is_new = str(extract_attr(attrs, "immo_sell_type")).lower() == "new"
    energy_heating = extract_attr(attrs, "energy_heating", True)
    heating_type = extract_attr(attrs, "heating_type", True)
    
    # New fields
    bd_str = extract_attr(attrs, "rooms_count") or extract_attr(attrs, "bedrooms")
    bedrooms = parse_int(bd_str)
    
    fur_str = extract_attr(attrs, "furnished")
    is_furnished = str(fur_str) in ["1", "Oui", "oui", "true"] if fur_str else None
    
    cel_str = extract_attr(attrs, "cellar")
    has_cellar = str(cel_str) in ["1", "Oui", "oui", "true"] if cel_str else None
    
    gar_str = extract_attr(attrs, "garage")
    has_garage = str(gar_str) in ["1", "Oui", "oui", "true"] if gar_str else None
    
    ter_str = extract_attr(attrs, "land_plot_surface")
    terrain = parse_float(ter_str)
    
    body = ad.get("body") or ""
    # LBC may return owner type: "private" | "professional"
    owner_type_val = ad.get("owner_type") or (ad.get("owner") or {}).get("type") or extract_attr(attrs, "ad_owner_type", True)
    owner_type = None
    if owner_type_val:
        v = str(owner_type_val).lower()
        if v in ("private", "particulier", "part"):
            owner_type = "private"
        elif v in ("professional", "pro", "professionnel"):
            owner_type = "professional"

    # Estimated yield & cashflow (same formula as frontend) for SQL filtering
    if price and price > 0 and surface and surface > 0:
        ppsqm = price / surface
        y = 10.5 - (ppsqm / 1000)
        y = max(3.0, min(10.0, y))
    else:
        y = 6.0
    cf = (price * (y / 100) * 0.7 - (price * 1.08 * 0.073)) / 12
    estimated_yield = round(y * 10) / 10
    estimated_cashflow = round(cf)

    return {
        "id": f"lbc_{ad_id}",
        "source": "leboncoin",
        "title": ad.get("subject") or "",
        "price": price,
        "surface": surface,
        "rooms": rooms,
        "city": city,
        "postalCode": zipcode,
        "propertyKind": property_kind,
        "listingType": listing_type,
        "url": url,
        "imageUrl": image_url,
        "description": body,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "pricePerSqm": price_per_sqm,
        "dpe": dpe,
        "ges": ges,
        "charges": charges,
        "floor": floor,
        "hasElevator": has_elevator,
        "hasBalcony": has_balcony,
        "hasParking": has_parking,
        "builtYear": built_year,
        "propertyTax": property_tax,
        "isNew": is_new,
        "energyHeating": energy_heating,
        "heatingType": heating_type,
        "bedrooms": bedrooms,
        "isFurnished": is_furnished,
        "hasCellar": has_cellar,
        "hasGarage": has_garage,
        "terrain": terrain,
        "nbPhotos": nb_photos,
        "ownerType": owner_type,
        "estimatedYield": estimated_yield,
        "estimatedCashflow": estimated_cashflow
    }


def main():
    parser = argparse.ArgumentParser(description="LBC scraper using curl_cffi and SQLite")
    parser.add_argument("--ad-id", type=int, default=None, metavar="ID", help="Fetch a single ad by list_id (for URL import); prints JSON to stdout")
    parser.add_argument("--city", default="Paris", help="City name (e.g. Paris, Lyon)")
    parser.add_argument("--type", default="buy", choices=["buy", "rent"], help="Listing type")
    parser.add_argument("--kind", default="both", choices=["apartment", "house", "both"])
    parser.add_argument("--limit", type=int, default=100, help="Max ads to fetch")
    parser.add_argument("--min-price", type=int, default=None)
    parser.add_argument("--max-price", type=int, default=None)
    parser.add_argument("--min-surface", type=int, default=None)
    parser.add_argument("--radius", type=int, default=10, help="Radius in km")
    parser.add_argument("--owner-type", default="all", choices=["all", "private", "professional"],
                        help="Filter by seller: all (default), private, professional")
    parser.add_argument("--output", default="data/properties.json", help="Ignored, kept for backward compat")
    parser.add_argument("--db", default="data/properties.db", help="Output SQLite DB file")
    parser.add_argument("--merge", action="store_true", help="Merge into existing DB (always true for SQLite)")
    args = parser.parse_args()

    # Single-ad fetch for URL import: output JSON to stdout and exit
    if args.ad_id is not None:
        session = make_session()
        if sum(1 for _ in session.cookies) == 0:
            try:
                session.get("https://www.leboncoin.fr/", timeout=15)
                time.sleep(1.0)
            except Exception:
                pass
        ad = fetch_ad_by_id(session, args.ad_id)
        if not ad:
            print(json.dumps({"error": "Annonce introuvable ou API indisponible"}))
            sys.exit(1)
        normalized = normalize_ad(ad, "buy", None)
        if not normalized:
            print(json.dumps({"error": "Données d'annonce invalides"}))
            sys.exit(1)
        # Output for parse-url API: flat dict with keys expected by frontend
        out = {
            "title": normalized.get("title"),
            "price": normalized.get("price"),
            "surface": normalized.get("surface"),
            "rooms": normalized.get("rooms"),
            "city": normalized.get("city"),
            "postalCode": normalized.get("postalCode"),
            "url": normalized.get("url"),
            "description": normalized.get("description"),
            "source": "LeBonCoin",
        }
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(0)

    # Automatically adapt if they passed output pointing to json
    db_path = args.db
    if args.output and args.output.endswith('.json'):
        db_path = args.output.replace('.json', '.db')

    conn = init_db(db_path)

    city_key = args.city.lower()
    city_label = str(CITIES.get(city_key, {}).get("label", args.city))
    radius_m = args.radius * 1000

    properties: list[dict] = []
    offset: int = 0
    page_size: int = 100
    total_to_fetch: int = args.limit

    print(f"Scraping LeBonCoin: city={args.city}, type={args.type}, kind={args.kind}, limit={total_to_fetch}")

    # Reuse 1 session
    session = make_session()

    while len(properties) < total_to_fetch:
        batch_size = min(page_size, total_to_fetch - len(properties))
        payload = build_payload(
            city_key=city_key,
            listing_type=args.type,
            kind=args.kind,
            limit=batch_size,
            offset=offset,
            min_price=args.min_price,
            max_price=args.max_price,
            min_surface=args.min_surface,
            radius_m=radius_m,
            owner_type=args.owner_type,
        )

        result = scrape_page(session, payload)
        if "error" in result:
            print(json.dumps({"error": result["error"], "count": len(properties)}))
            save_to_db(conn, properties)
            return

        ads = result.get("ads") or []
        if not ads:
            break

        batch_properties = []
        for ad in ads:
            normalized = normalize_ad(ad, args.type, city_label)
            if normalized:
                batch_properties.append(normalized)
        
        properties.extend(batch_properties)
        save_to_db(conn, batch_properties)

        print(f"  Fetched {len(ads)} ads (offset={offset}), total so far: {len(properties)}")

        if len(ads) < batch_size:
            break

        offset += len(ads)
        if offset >= total_to_fetch:
            break

        time.sleep(random.uniform(1.5, 3.5))

    conn.close()

    print(json.dumps({
        "count": len(properties),
        "city": city_label,
        "type": args.type,
        "kind": args.kind,
    }))


if __name__ == "__main__":
    main()
