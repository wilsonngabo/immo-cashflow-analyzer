#!/usr/bin/env python3
"""
Scrape current mortgage rates from CAFPI baromètre.
Stores national rates by duration + regional rates into SQLite.

Source: https://www.cafpi.fr/credit-immobilier/barometre-taux/actualites-taux/
Uses LBC_PROXY or HTTPS_PROXY when set (never expose personal IP).
"""

import re
import sqlite3
import os
from datetime import datetime

def _get_proxies():
    """Use proxy when set (protects personal IP)."""
    p = os.environ.get("LBC_PROXY") or os.environ.get("HTTPS_PROXY")
    if not p:
        return None
    return {"https": p, "http": p}

try:
    from curl_cffi import requests as cffi_requests
    def fetch_html(url: str) -> str:
        proxies = _get_proxies()
        kw = {"impersonate": "chrome", "timeout": 30}
        if proxies:
            kw["proxies"] = proxies
        resp = cffi_requests.get(url, **kw)
        resp.raise_for_status()
        return resp.text
except ImportError:
    import urllib.request
    def fetch_html(url: str) -> str:
        proxies = _get_proxies()
        if proxies:
            proxy_url = proxies.get("https") or proxies.get("http")
            proxy_handler = urllib.request.ProxyHandler({"https": proxy_url, "http": proxy_url})
            opener = urllib.request.build_opener(proxy_handler)
            urllib.request.install_opener(opener)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")

from bs4 import BeautifulSoup

CAFPI_URL = "https://www.cafpi.fr/credit-immobilier/barometre-taux/actualites-taux/analyse-taux-credit-immobilier"

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_FILE = os.path.join(DATA_DIR, "properties.db")

DURATIONS = [10, 15, 20, 25]

REGION_NAMES = [
    "Ile-de-France", "Île-de-France",
    "Bretagne",
    "Grand Est",
    "Provence-Alpes-Côte d'Azur",
    "Pays de la Loire",
    "Bourgogne-Franche-Comté",
    "Hauts-de-France",
    "DROM-COM",
    "Normandie",
    "Nouvelle-Aquitaine",
    "Auvergne-Rhône-Alpes",
    "Occitanie",
    "Corse",
    "Centre-Val de Loire",
]

def normalize_region(name: str) -> str:
    """Normalize region name to match the geography.ts REGIONS keys."""
    mapping = {
        "ile-de-france": "Île-de-France",
        "île-de-france": "Île-de-France",
        "bretagne": "Bretagne",
        "grand est": "Grand Est",
        "provence-alpes-côte d'azur": "Provence-Alpes-Côte d'Azur",
        "pays de la loire": "Pays de la Loire",
        "bourgogne-franche-comté": "Bourgogne-Franche-Comté",
        "hauts-de-france": "Hauts-de-France",
        "drom-com": "DROM-COM",
        "normandie": "Normandie",
        "nouvelle-aquitaine": "Nouvelle-Aquitaine",
        "auvergne-rhône-alpes": "Auvergne-Rhône-Alpes",
        "occitanie": "Occitanie",
        "corse": "Corse",
        "centre-val de loire": "Centre-Val de Loire",
    }
    return mapping.get(name.strip().lower(), name.strip())


def parse_rate(text: str) -> float | None:
    """Extract a rate like '3,41 %' or '3.41%' from text."""
    text = text.replace("\xa0", " ").replace("&nbsp;", " ").strip()
    m = re.search(r"(\d+)[,.](\d+)\s*%", text)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")
    return None


def find_current_month_url() -> str:
    """Build the CAFPI URL for the current month's analysis."""
    now = datetime.now()
    months_fr = {
        1: "janvier", 2: "fevrier", 3: "mars", 4: "avril",
        5: "mai", 6: "juin", 7: "juillet", 8: "aout",
        9: "septembre", 10: "octobre", 11: "novembre", 12: "decembre",
    }
    month_name = months_fr[now.month]
    return f"{CAFPI_URL}-{month_name}-{now.year}"


def scrape_rates() -> dict:
    """Scrape CAFPI and return structured rate data.
    Returns: {
        'date': '2026-03-13',
        'source': 'CAFPI',
        'national': {10: 3.02, 15: 3.13, 20: 3.26, 25: 3.41},
        'regional': {'Île-de-France': {10: 3.02, 15: 3.02, 20: 3.16, 25: 3.35}, ...}
    }
    """
    url = find_current_month_url()
    print(f"[RATES] Fetching {url}")

    try:
        html = fetch_html(url)
    except Exception as e:
        print(f"[RATES] Could not fetch current month, trying previous month: {e}")
        now = datetime.now()
        if now.month == 1:
            prev_month, prev_year = 12, now.year - 1
        else:
            prev_month, prev_year = now.month - 1, now.year
        months_fr = {
            1: "janvier", 2: "fevrier", 3: "mars", 4: "avril",
            5: "mai", 6: "juin", 7: "juillet", 8: "aout",
            9: "septembre", 10: "octobre", 11: "novembre", 12: "decembre",
        }
        url = f"{CAFPI_URL}-{months_fr[prev_month]}-{prev_year}"
        print(f"[RATES] Fetching fallback {url}")
        html = fetch_html(url)

    soup = BeautifulSoup(html, "html.parser")
    result = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "source": "CAFPI",
        "source_url": url,
        "national": {},
        "regional": {},
    }

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        headers = [th.get_text(strip=True) for th in rows[0].find_all(["th", "td"])]
        header_text = " ".join(headers).lower()

        # National rates table: look for rows with "Taux fixe X ans"
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            label = cells[0].get_text(strip=True).lower()

            if "taux fixe" in label:
                duration_match = re.search(r"(\d+)\s*ans", label)
                if duration_match:
                    duration = int(duration_match.group(1))
                    last_cell = cells[-1].get_text(strip=True)
                    rate = parse_rate(last_cell)
                    if rate and duration in DURATIONS:
                        result["national"][duration] = rate

        # Regional rates table: look for region names in rows
        if any(normalize_region(cells[0].get_text(strip=True)).lower() in
               [r.lower() for r in REGION_NAMES]
               for row_ in rows[1:]
               for cells in [row_.find_all(["td", "th"])]
               if cells):

            dur_headers = []
            for h in headers[1:]:
                m = re.search(r"(\d+)\s*ans", h.lower())
                if m:
                    dur_headers.append(int(m.group(1)))
                else:
                    dur_headers.append(None)

            for row_ in rows[1:]:
                cells = row_.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                region_raw = cells[0].get_text(strip=True)
                region = normalize_region(region_raw)

                region_rates = {}
                for i, cell in enumerate(cells[1:]):
                    if i < len(dur_headers) and dur_headers[i]:
                        rate = parse_rate(cell.get_text(strip=True))
                        if rate:
                            region_rates[dur_headers[i]] = rate

                if region_rates:
                    result["regional"][region] = region_rates

    print(f"[RATES] National: {result['national']}")
    print(f"[RATES] Regional: {len(result['regional'])} regions")
    return result


def init_rates_table(conn: sqlite3.Connection) -> None:
    """Create the mortgage_rates table if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS mortgage_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scrapedAt TEXT NOT NULL,
            source TEXT NOT NULL,
            sourceUrl TEXT,
            duration INTEGER NOT NULL,
            region TEXT,
            rate REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_rates_scraped ON mortgage_rates(scrapedAt DESC)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_rates_region ON mortgage_rates(region, duration)
    """)
    conn.commit()


def store_rates(conn: sqlite3.Connection, data: dict) -> int:
    """Store scraped rates into DB. Returns number of rows inserted."""
    init_rates_table(conn)
    scraped_at = data["date"]
    source = data["source"]
    source_url = data.get("source_url", "")
    count = 0

    # National rates (region = NULL means national)
    for duration, rate in data["national"].items():
        conn.execute(
            "INSERT INTO mortgage_rates (scrapedAt, source, sourceUrl, duration, region, rate) VALUES (?, ?, ?, ?, NULL, ?)",
            (scraped_at, source, source_url, duration, rate),
        )
        count += 1

    # Regional rates
    for region, rates in data["regional"].items():
        for duration, rate in rates.items():
            conn.execute(
                "INSERT INTO mortgage_rates (scrapedAt, source, sourceUrl, duration, region, rate) VALUES (?, ?, ?, ?, ?, ?)",
                (scraped_at, source, source_url, duration, region, rate),
            )
            count += 1

    conn.commit()
    print(f"[RATES] Stored {count} rate entries for {scraped_at}")
    return count


def run(db_file: str | None = None) -> dict:
    """Full pipeline: scrape + store. Returns the rate data dict."""
    if db_file is None:
        db_file = DB_FILE
    os.makedirs(os.path.dirname(db_file), exist_ok=True)

    data = scrape_rates()

    if not data["national"]:
        print("[RATES] WARNING: No national rates found — skipping DB store")
        return data

    conn = sqlite3.connect(db_file)
    init_rates_table(conn)

    # Clear today's rates if re-running same day
    conn.execute("DELETE FROM mortgage_rates WHERE scrapedAt = ?", (data["date"],))
    conn.commit()

    store_rates(conn, data)
    conn.close()
    return data


if __name__ == "__main__":
    data = run()
    print("\n=== Rates Summary ===")
    print(f"Date: {data['date']}")
    print(f"National: {data['national']}")
    for region, rates in sorted(data['regional'].items()):
        print(f"  {region}: {rates}")
