#!/usr/bin/env python3
"""Show how many listings have been scraped so far."""
import os
import sqlite3
from datetime import datetime

DB = os.environ.get("DB_FILE") or os.path.join(
    os.path.dirname(__file__), "..", "data", "properties.db"
)

if not os.path.isfile(DB):
    print(f"Database not found: {DB}")
    exit(1)

conn = sqlite3.connect(DB)

print(f"Scrape stats — {datetime.now():%Y-%m-%d %H:%M}")
print()

total = conn.execute("SELECT COUNT(*) FROM properties").fetchone()[0]
print(f"Total listings: {total:,}")

print("\nBy source:")
for row in conn.execute(
    "SELECT source, COUNT(*) as c FROM properties GROUP BY source ORDER BY c DESC"
):
    print(f"  {row[0]}: {row[1]:,}")

print("\nBy region (buy, leboncoin):")
for row in conn.execute(
    "SELECT region, COUNT(*) as c FROM properties WHERE source='leboncoin' AND listingType='buy' GROUP BY region ORDER BY c DESC"
):
    print(f"  {row[0] or '(null)'}: {row[1]:,}")

today = conn.execute(
    "SELECT COUNT(*) FROM properties WHERE date(scrapedAt) = date('now')"
).fetchone()[0]
print(f"\nScraped today: {today:,}")

conn.close()
