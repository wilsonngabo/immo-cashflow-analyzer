"""Shared database schema and helpers."""

import os
import sqlite3

PROPERTIES_SCHEMA = """
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
    nbPhotos INTEGER,
    ownerType TEXT,
    estimatedYield REAL,
    estimatedCashflow REAL,
    region TEXT
)
"""

OPTIONAL_COLUMNS = [
    ("ownerType", "TEXT"),
    ("estimatedYield", "REAL"),
    ("estimatedCashflow", "REAL"),
    ("region", "TEXT"),
]


def init_db(db_path: str) -> sqlite3.Connection:
    """Create DB and schema. Returns connection."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(PROPERTIES_SCHEMA)
    for col, typ in OPTIONAL_COLUMNS:
        try:
            conn.execute(f"ALTER TABLE properties ADD COLUMN {col} {typ}")
            conn.commit()
        except sqlite3.OperationalError:
            pass
    return conn


def save_to_db(conn: sqlite3.Connection, properties: list[dict]) -> tuple[int, int]:
    """Incremental insert: only adds records whose id is not already in DB. Returns (added, total)."""
    if not properties:
        return 0, 0
    ids = [p["id"] for p in properties if p.get("id")]
    if not ids:
        return 0, len(properties)
    placeholders = ",".join("?" for _ in ids)
    existing = set(
        row[0]
        for row in conn.execute(
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
    rows = [[p.get(c) for c in cols] for p in to_insert]
    placeholders = ",".join("?" for _ in cols)
    col_list = ", ".join(cols)
    conn.executemany(
        f"INSERT INTO properties ({col_list}) VALUES ({placeholders})",
        rows,
    )
    conn.commit()
    return len(to_insert), len(properties)
