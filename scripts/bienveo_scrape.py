#!/usr/bin/env python3
"""
Bienveo.fr Scraper — logements HLM, via __NEXT_DATA__ (Next.js SSR).
Bienveo agrège les offres de +200 bailleurs sociaux français.

Refs: https://www.bienveo.fr/rechercher/location-france
      https://www.bienveo.fr/rechercher/vente-france

Usage:
    python scripts/bienveo_scrape.py --limit 200 --type rent --db data/properties.db
    LBC_PROXY=http://user:pass@host:port python scripts/bienveo_scrape.py ...
"""

import os
import sys
import json
import argparse
import time
import random
import re
import sqlite3
import unicodedata
import urllib.parse
from datetime import datetime, timezone

try:
    from curl_cffi import requests as cf_requests
except ImportError:
    print(json.dumps({"error": "curl_cffi not installed. Run: pip install curl_cffi"}), file=sys.stderr)
    sys.exit(1)

BIENVEO_BASE = "https://www.bienveo.fr"
BIENVEO_SEARCH_URL = BIENVEO_BASE + "/rechercher/{slug}"

IMPERSONATE_OPTIONS = ["chrome110", "chrome107", "chrome104", "edge101"]

# Property type codes to include (apartment & house only, skip parking/commerce)
INCLUDE_TYPES = {"appartement", "maison"}

# Mapping department → region (simplified, from postal code prefix)
# Imported at runtime from regions.py if available
def _load_region_map():
    """Return {dept_code: region_name} dict from regions.py if available, else empty."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "regions",
            os.path.join(os.path.dirname(__file__), "regions.py")
        )
        if spec is None or spec.loader is None:
            return {}
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore[union-attr]
        dept_to_region = {}
        for region_name, dept_codes in mod.REGIONS.items():
            for code in dept_codes:
                dept_to_region[str(code).zfill(2)] = region_name
        return dept_to_region
    except Exception:
        return {}

DEPT_TO_REGION = _load_region_map()


def _get_proxies():
    p = os.environ.get("LBC_PROXY") or os.environ.get("HTTPS_PROXY")
    if not p:
        return None
    return {"https": p, "http": p}


def make_session(impersonate=None):
    imp = impersonate or random.choice(IMPERSONATE_OPTIONS)
    proxies = _get_proxies()
    if proxies:
        return cf_requests.Session(impersonate=imp, proxies=proxies)
    return cf_requests.Session(impersonate=imp)


# ─── Database ────────────────────────────────────────────────────────────────

def init_db(db_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute('''
        CREATE TABLE IF NOT EXISTS properties (
            id TEXT PRIMARY KEY,
            source TEXT, title TEXT, price REAL, surface REAL, rooms INTEGER,
            city TEXT, postalCode TEXT, propertyKind TEXT, listingType TEXT,
            url TEXT, imageUrl TEXT, description TEXT, scrapedAt TEXT,
            pricePerSqm REAL, dpe TEXT, ges TEXT, charges REAL, floor INTEGER,
            hasElevator BOOLEAN, hasBalcony BOOLEAN, hasParking BOOLEAN,
            builtYear INTEGER, propertyTax REAL, isNew BOOLEAN,
            energyHeating TEXT, heatingType TEXT, bedrooms INTEGER,
            isFurnished BOOLEAN, hasCellar BOOLEAN, hasGarage BOOLEAN,
            terrain REAL, nbPhotos INTEGER, ownerType TEXT,
            estimatedYield REAL, estimatedCashflow REAL, region TEXT
        )
    ''')
    for col, typ in (
        ("ownerType", "TEXT"), ("estimatedYield", "REAL"),
        ("estimatedCashflow", "REAL"), ("region", "TEXT"),
    ):
        try:
            conn.execute(f"ALTER TABLE properties ADD COLUMN {col} {typ}")
            conn.commit()
        except Exception:
            pass
    return conn


def save_to_db(conn, properties):
    """Incremental insert: only adds records whose id is not already in DB."""
    if not properties:
        return 0, 0
    ids = [p["id"] for p in properties if p.get("id")]
    if not ids:
        return 0, len(properties)
    placeholders = ",".join("?" for _ in ids)
    existing = set(
        row[0] for row in conn.execute(
            f"SELECT id FROM properties WHERE id IN ({placeholders})", ids
        ).fetchall()
    )
    to_insert = [p for p in properties if p.get("id") and p["id"] not in existing]
    if not to_insert:
        return 0, len(properties)
    cols = [
        "id", "source", "title", "price", "surface", "rooms", "city", "postalCode",
        "propertyKind", "listingType", "url", "imageUrl", "description", "scrapedAt",
        "pricePerSqm", "dpe", "ges", "charges", "floor", "hasElevator", "hasBalcony",
        "hasParking", "builtYear", "propertyTax", "isNew", "energyHeating", "heatingType",
        "bedrooms", "isFurnished", "hasCellar", "hasGarage", "terrain", "nbPhotos",
        "ownerType", "estimatedYield", "estimatedCashflow", "region",
    ]
    placeholders_insert = ",".join(f":{c}" for c in cols)
    col_list = ", ".join(cols)
    conn.executemany(
        f"INSERT INTO properties ({col_list}) VALUES ({placeholders_insert})",
        to_insert,
    )
    conn.commit()
    return len(to_insert), len(properties) - len(to_insert)


# ─── Fetching ────────────────────────────────────────────────────────────────

def fetch_search_page(session, slug: str, page: int, retries: int = 3) -> list[dict] | None:
    """Fetch a bienveo search page and return the list of hit _source dicts, or None on error."""
    url = BIENVEO_SEARCH_URL.format(slug=slug)
    params = {"page": str(page)} if page > 1 else {}
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer": BIENVEO_BASE + "/",
    }
    for attempt in range(retries):
        try:
            if attempt == 0:
                # Warmup on first call ever (check cookie jar)
                if not getattr(session, "_bienveo_warmed", False):
                    session.get(BIENVEO_BASE + "/", timeout=15, headers=headers)
                    session._bienveo_warmed = True
                    time.sleep(random.uniform(0.8, 1.5))

            resp = session.get(url, params=params, headers=headers, timeout=20)
            if resp.status_code == 403:
                if attempt < retries - 1:
                    time.sleep(3 + attempt * 3)
                    continue
                print(f"[bienveo] Blocked (403) on page {page}", file=sys.stderr)
                return None
            if resp.status_code != 200:
                print(f"[bienveo] HTTP {resp.status_code} on page {page}", file=sys.stderr)
                return None

            html = resp.text
            m = re.search(
                r'<script id="__NEXT_DATA__" type="application/json">([\s\S]+?)</script>',
                html
            )
            if not m:
                print(f"[bienveo] No __NEXT_DATA__ on page {page}", file=sys.stderr)
                return None

            data = json.loads(m.group(1))
            search_response = (
                data.get("props", {})
                    .get("pageProps", {})
                    .get("defaultSearchResponse", {})
            )
            hits = search_response.get("hits", {}).get("hits", [])
            return hits

        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1.5)
                continue
            print(f"[bienveo] Exception on page {page}: {e}", file=sys.stderr)
            return None
    return None


# ─── Normalisation ────────────────────────────────────────────────────────────

def _get_data(data_dict: dict, key: str):
    """Extract .value from a bienveo data field dict."""
    field = data_dict.get(key)
    if isinstance(field, dict):
        return field.get("value")
    return field


def _bool_data(data_dict: dict, *keys: str) -> bool:
    for k in keys:
        v = _get_data(data_dict, k)
        if v is True or str(v).lower() in ("true", "oui", "1"):
            return True
    return False


def normalize_hit(hit: dict, listing_type: str) -> dict | None:
    """Convert a bienveo ES hit to our Property schema dict."""
    src = hit.get("_source", {})
    if not src:
        return None

    # Filter: only include apartments and houses
    type_str = str(src.get("type", "")).lower()
    product_desc = str(src.get("productType", {}).get("description", "")).lower()
    is_housing = any(t in type_str for t in INCLUDE_TYPES) or any(t in product_desc for t in INCLUDE_TYPES)
    if not is_housing:
        return None

    reference = src.get("reference") or str(src.get("id", ""))
    if not reference:
        return None

    price = src.get("price")
    if not price:
        return None

    data = src.get("data", {})

    surface_val = _get_data(data, "surface_habitable")
    if surface_val is None:
        surface_val = _get_data(data, "surface")  # fallback
    surface = float(surface_val) if surface_val is not None else None

    rooms_val = _get_data(data, "nb_pieces_logement")
    rooms = int(rooms_val) if rooms_val is not None else None

    bedrooms_val = _get_data(data, "nombre_de_chambres")
    bedrooms = int(bedrooms_val) if bedrooms_val is not None else None

    city = _get_data(data, "ville") or ""
    postal_code = str(_get_data(data, "code_postal") or "")
    dept = str(_get_data(data, "departement") or "")

    # Region from department
    dept_padded = dept.zfill(2) if dept and len(dept) <= 2 else dept
    region = DEPT_TO_REGION.get(dept_padded)

    # Property kind
    if "appartement" in type_str or "t1" in product_desc or "t2" in product_desc or "t3" in product_desc or "t4" in product_desc or "t5" in product_desc:
        property_kind = "apartment"
    elif "maison" in type_str or "villa" in type_str:
        property_kind = "house"
    else:
        property_kind = "apartment"  # default for HLM

    # URL
    product_type_raw = src.get("productType", {}).get("description", "logement")
    url = f"{BIENVEO_BASE}/offre/{urllib.parse.quote(product_type_raw, safe='')}/{reference}"

    # Images
    pictures = src.get("mediaSupports", {}).get("pictures", [])
    image_url = ""
    if pictures:
        first_pic = pictures[0]
        if isinstance(first_pic, str):
            image_url = first_pic
        elif isinstance(first_pic, dict):
            image_url = first_pic.get("url") or first_pic.get("urlMini") or first_pic.get("path") or ""
    nb_photos = len(pictures) if isinstance(pictures, list) else 0

    # Diagnostics
    dpe = str(_get_data(data, "dpe_etiquette_conso") or "").strip() or None
    ges = str(_get_data(data, "dpe_etiquette_ges") or "").strip() or None

    charges_val = _get_data(data, "charges_locatives")
    charges = float(charges_val) if charges_val is not None else None

    floor_val = _get_data(data, "etage")
    floor = int(floor_val) if floor_val is not None else None

    has_elevator = _bool_data(data, "ascenseur")
    has_balcony = _bool_data(data, "balcon", "terrasse")
    has_parking = _bool_data(data, "garage", "avec_stationnement", "possede_box")
    has_cellar = _bool_data(data, "cave")
    is_furnished = _bool_data(data, "meuble", "meublee")

    energy_heating = str(_get_data(data, "chauffage_energie") or "").strip() or None
    heating_type = str(_get_data(data, "chauffage_type") or "").strip() or None

    # For HLM rent listings, yield/cashflow cannot be computed (no sale price)
    estimated_yield = None
    estimated_cashflow = None

    price_per_sqm = round(price / surface) if surface and price and surface > 0 else None

    return {
        "id": f"bie_{reference}",
        "source": "bienveo",
        "title": (src.get("title") or _get_data(data, "titre") or "")[:200],
        "price": float(price),
        "surface": surface,
        "rooms": rooms,
        "city": str(city).title(),
        "postalCode": postal_code,
        "propertyKind": property_kind,
        "listingType": listing_type,
        "url": url,
        "imageUrl": image_url,
        "description": (src.get("description") or "")[:2000],
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "pricePerSqm": price_per_sqm,
        "dpe": dpe,
        "ges": ges,
        "charges": charges,
        "floor": floor,
        "hasElevator": has_elevator,
        "hasBalcony": has_balcony,
        "hasParking": has_parking,
        "builtYear": None,
        "propertyTax": None,
        "isNew": False,
        "energyHeating": energy_heating,
        "heatingType": heating_type.title() if heating_type else None,
        "bedrooms": bedrooms,
        "isFurnished": is_furnished,
        "hasCellar": has_cellar,
        "hasGarage": has_parking,
        "terrain": None,
        "nbPhotos": nb_photos,
        "ownerType": "professional",  # all bienveo advertisers are social landlords (bailleurs sociaux)
        "estimatedYield": estimated_yield,
        "estimatedCashflow": estimated_cashflow,
        "region": region,
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Bienveo.fr scraper via __NEXT_DATA__ (HLM listings)")
    parser.add_argument("--city", default=None, help="City/location slug (optional; default: all France)")
    parser.add_argument("--kind", default="both", choices=["apartment", "house", "both"],
                        help="Property kind (default: both)")
    parser.add_argument("--limit", type=int, default=200, help="Max listings to fetch")
    parser.add_argument("--type", default="rent", choices=["rent", "buy"],
                        help="Listing type: rent (location) or buy (vente). Default: rent")
    parser.add_argument("--db", default="data/properties.db", help="SQLite output DB")
    args = parser.parse_args()

    # Build URL slugs — for "both" we scrape appartement + maison separately
    # because location-france mixes in parking/commerce results
    transaction_slug = "location" if args.type == "rent" else "vente"

    city_slug = ""
    if args.city:
        normalized = unicodedata.normalize("NFKD", args.city.lower())
        ascii_city = "".join(c for c in normalized if not unicodedata.combining(c))
        city_slug = "-" + re.sub(r"[^a-z0-9]+", "-", ascii_city).strip("-")

    suffix = city_slug if city_slug else "-france"

    if args.kind == "apartment":
        slugs = [f"{transaction_slug}-appartement{suffix}"]
    elif args.kind == "house":
        slugs = [f"{transaction_slug}-maison{suffix}"]
    else:
        slugs = [
            f"{transaction_slug}-appartement{suffix}",
            f"{transaction_slug}-maison{suffix}",
        ]

    print(f"Scraping Bienveo: slugs={slugs}, limit={args.limit}, type={args.type}", file=sys.stderr)

    conn = init_db(args.db)
    session = make_session()
    properties: list[dict] = []
    limit_per_slug = max(1, args.limit // len(slugs))

    for slug in slugs:
        page = 1
        slug_count = 0
        consecutive_errors = 0

        while slug_count < limit_per_slug:
            hits = fetch_search_page(session, slug, page)

            if hits is None:
                consecutive_errors += 1
                if consecutive_errors >= 3:
                    print(f"[bienveo] 3 consecutive errors on {slug}, stopping.", file=sys.stderr)
                    break
                time.sleep(5)
                continue

            consecutive_errors = 0

            if not hits:
                print(f"[bienveo] No more results at page {page} for {slug}", file=sys.stderr)
                break

            batch = []
            for hit in hits:
                norm = normalize_hit(hit, args.type)
                if norm:
                    batch.append(norm)

            added, _ = save_to_db(conn, batch)
            properties.extend(batch)
            slug_count += len(batch)
            print(f"  [{slug}] Page {page}: {len(hits)} hits, {len(batch)} valid, {added} new → DB (total: {len(properties)})", file=sys.stderr)

            if len(hits) < 15:
                break

            page += 1
            time.sleep(random.uniform(1.0, 2.5))

    conn.close()

    print(json.dumps({
        "count": len(properties),
        "city": args.city or "France",
        "type": args.type,
        "kind": args.kind,
    }))


if __name__ == "__main__":
    main()
