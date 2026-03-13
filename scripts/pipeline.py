#!/usr/bin/env python3
"""
Unified pipeline: Bienveo first, then incremental LeBonCoin across France.

VPN is MANDATORY by default — the pipeline refuses to start without NordVPN.
This protects your personal IP from being exposed to scraped websites.

Phase 1 — Bienveo: fast, reliable, writes directly to SQLite.
Phase 2 — LBC: incremental per dept+tranche, resumable, VPN rotation on blocks.

Usage:
    python scripts/pipeline.py                                  # Full (bienveo + LBC via VPN)
    python scripts/pipeline.py --lbc-only                       # LBC only via VPN
    python scripts/pipeline.py --lbc-only --shutdown            # + auto shutdown when done
    python scripts/pipeline.py --bienveo-only                   # Bienveo only via VPN
    PIPELINE_MODE=buy python scripts/pipeline.py --lbc-only
    LBC_RESUME=0 python scripts/pipeline.py --lbc-only          # Reset progress
"""

import os
import sys

# Unbuffered output so progress is visible when run from scripts/automation
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(line_buffered=True)
        sys.stderr.reconfigure(line_buffered=True)
    except Exception:
        pass
import time
import json
import random
import sqlite3
import subprocess
import argparse
import ctypes
import traceback
from datetime import datetime

import lbc_scrape
import rates_scrape
from regions import REGIONS, DEPARTMENTS, region_slug

# ─── Configuration ───────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_FILE = os.path.join(DATA_DIR, "properties.db")
LBC_PROGRESS_FILE = os.path.join(DATA_DIR, "lbc_progress.json")
PAGE_SIZE = 100

MAX_ADS_PER_SEARCH = 10_000
MAX_PER_SEARCH_OFFSET = 2500

PRICE_RANGES_BUY = [(p, p + 25_000) for p in range(0, 2_000_000, 25_000)] + [(2_000_000, 10_000_000)]
PRICE_RANGES_RENT = [(p, p + 100) for p in range(0, 5_000, 100)] + [(5_000, 50_000)]

# Delays — overridden when --vpn is used
DELAY_MIN_NORMAL = 2.0
DELAY_MAX_NORMAL = 5.0
DELAY_MIN_VPN = 0.3
DELAY_MAX_VPN = 0.8
SESSION_ROTATE_NORMAL = 100
SESSION_ROTATE_VPN = 50

BACKOFF_INITIAL = 45
BACKOFF_MULTIPLIER = 2
BACKOFF_MAX = 360
MAX_BLOCK_ROUNDS = 5

# NordVPN CLI: Windows path vs Linux/macOS (nordvpn from PATH)
import platform
if platform.system() == "Windows":
    NORDVPN_CLI = os.environ.get("NORDVPN_CLI", r"C:\Program Files\NordVPN\nordvpn.exe")
else:
    NORDVPN_CLI = os.environ.get("NORDVPN_CLI", "nordvpn")

ESTIMATED_TOTAL_LISTINGS = 1_000_000


def prevent_sleep():
    """Tell OS to stay awake while scraping. Windows: SetThreadExecutionState. Linux: systemd-inhibit (if available)."""
    if platform.system() == "Windows":
        try:
            ES_CONTINUOUS = 0x80000000
            ES_SYSTEM_REQUIRED = 0x00000001
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
            print("[POWER] Sleep mode disabled — PC will stay awake")
        except Exception as e:
            print(f"[POWER] Could not disable sleep: {e}")
    else:
        # Linux/macOS: no-op (desktop sleep prevention not commonly needed for scraping)
        pass


def allow_sleep():
    """Re-enable normal OS sleep behavior."""
    if platform.system() == "Windows":
        try:
            ES_CONTINUOUS = 0x80000000
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
            print("[POWER] Sleep mode re-enabled")
        except Exception as e:
            print(f"[POWER] Could not re-enable sleep: {e}")


def get_price_ranges(listing_type: str) -> list[tuple[int, int]]:
    return PRICE_RANGES_RENT if listing_type == "rent" else PRICE_RANGES_BUY


# ─── VPN: Proxy (Gluetun) vs Host NordVPN vs Docker NordVPN (tmknight) ───────────
# Proxy mode: SCRAPER_VPN_PROXY_MODE=1 — uses Gluetun (separate from Plex), LBC traffic via proxy
# Docker NordVPN: SCRAPER_VPN_DOCKER_NORDVPN=1 — scraper inside tmknight container, rotate via docker exec

SCRAPER_VPN_PROXY = os.environ.get("SCRAPER_VPN_PROXY", "http://localhost:8888").strip()
SCRAPER_VPN_CONTAINER = os.environ.get("SCRAPER_VPN_CONTAINER", "gluetun-scraper").strip()
SCRAPER_VPN_DOCKER_NORDVPN_CONTAINER = os.environ.get(
    "SCRAPER_VPN_DOCKER_NORDVPN_CONTAINER", "nordvpn-scraper"
).strip()


def use_proxy_vpn() -> bool:
    """Use Gluetun proxy (does not affect Plex) instead of host NordVPN."""
    return os.environ.get("SCRAPER_VPN_PROXY_MODE", "0") in ("1", "true", "yes")


def use_docker_nordvpn() -> bool:
    """Scraper runs inside tmknight NordVPN container; rotate via docker exec."""
    return os.environ.get("SCRAPER_VPN_DOCKER_NORDVPN", "0") in ("1", "true", "yes")


def _docker_cmd():
    """Return docker compose command (docker-compose or docker compose)."""
    for cmd in ["docker-compose", "docker compose"]:
        try:
            subprocess.run(cmd.split() + ["version"], capture_output=True, timeout=5)
            return cmd.split()
        except Exception:
            pass
    return ["docker-compose"]


def ensure_proxy_vpn_ready() -> bool:
    """Ensure Gluetun scraper container is running; set LBC_PROXY."""
    if not use_proxy_vpn():
        return False
    try:
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", SCRAPER_VPN_CONTAINER],
            capture_output=True, timeout=5, text=True
        )
        if result.returncode != 0 or "true" not in (result.stdout or "").lower():
            print(f"[VPN] Starting {SCRAPER_VPN_CONTAINER}...")
            project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            compose_file = os.path.join(project_dir, "docker-compose.scraper-vpn.yml")
            subprocess.run(
                _docker_cmd() + ["-f", compose_file, "up", "-d"],
                cwd=project_dir, capture_output=True, timeout=60
            )
            time.sleep(10)
    except Exception as e:
        print(f"[VPN] Docker check failed: {e}")
        return False

    os.environ["LBC_PROXY"] = SCRAPER_VPN_PROXY
    print(f"[VPN] Proxy mode: {SCRAPER_VPN_PROXY} (Plex unaffected)")
    return True


def rotate_proxy_vpn() -> bool:
    """Rotate IP by restarting Gluetun scraper container."""
    if not SCRAPER_VPN_CONTAINER:
        return False
    print(f"    [VPN] Rotating: docker restart {SCRAPER_VPN_CONTAINER}")
    try:
        subprocess.run(["docker", "restart", SCRAPER_VPN_CONTAINER], capture_output=True, timeout=30)
        time.sleep(15)
        return True
    except Exception as e:
        print(f"    [VPN] Rotation failed: {e}")
        return False


def _rotate_docker_nordvpn() -> bool:
    """Rotate IP by disconnect/connect inside tmknight NordVPN container (requires docker socket)."""
    container = SCRAPER_VPN_DOCKER_NORDVPN_CONTAINER
    print(f"    [VPN] Rotating: docker exec {container} nordvpn disconnect + connect France")
    try:
        import docker as docker_module
        client = docker_module.from_env()
        nordvpn = client.containers.get(container)
        nordvpn.exec_run("nordvpn disconnect", detach=False)
        time.sleep(5)
        nordvpn.exec_run("nordvpn connect France", detach=False)
        time.sleep(5)
        return True
    except ImportError:
        print("    [VPN] pip install docker required for tmknight rotation")
        return False
    except Exception as e:
        print(f"    [VPN] Docker NordVPN rotation failed: {e}")
        return False


def rotate_vpn() -> bool:
    """Disconnect and reconnect VPN for fresh IP. Proxy: restart Gluetun. Docker NordVPN: exec disconnect/connect. Host: NordVPN CLI."""
    if use_proxy_vpn():
        return rotate_proxy_vpn()
    if use_docker_nordvpn():
        return _rotate_docker_nordvpn()
    print("    [VPN] Rotating to new French server...")
    try:
        subprocess.run([NORDVPN_CLI, "-d"], capture_output=True, timeout=10)
    except Exception:
        pass
    time.sleep(3)

    for attempt in range(3):
        try:
            subprocess.run([NORDVPN_CLI, "-c", "-g", "France"],
                           capture_output=True, timeout=30, text=True)
            time.sleep(5)
            if is_vpn_connected():
                print("    [VPN] Connected to new French server")
                return True
        except Exception as e:
            print(f"    [VPN] Rotation attempt {attempt + 1} failed: {e}")
        time.sleep(5)

    print("    [VPN] WARNING: Could not rotate — retrying ensure_vpn_connected")
    ensure_vpn_connected()
    return is_vpn_connected()


def is_vpn_connected() -> bool:
    """Check if VPN is ready. Proxy: container running. Docker NordVPN: assume true. Host: NordVPN connected."""
    if use_docker_nordvpn():
        return True  # Already in VPN container
    if use_proxy_vpn():
        try:
            result = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", SCRAPER_VPN_CONTAINER],
                capture_output=True, timeout=5, text=True
            )
            return result.returncode == 0 and "true" in (result.stdout or "").lower()
        except Exception:
            return False
    try:
        result = subprocess.run([NORDVPN_CLI, "status"],
                                capture_output=True, timeout=10, text=True)
        output = (result.stdout + result.stderr).lower()
        return "connected" in output and "disconnected" not in output
    except Exception:
        return False


def ensure_vpn_connected():
    """Make sure VPN is ready. Proxy: start Gluetun. Docker NordVPN: no-op. Host: connect NordVPN to France."""
    if use_docker_nordvpn():
        return  # Already in VPN container
    if use_proxy_vpn():
        if ensure_proxy_vpn_ready():
            return
        print("[VPN] FATAL: Could not start Gluetun scraper. Run: docker compose -f docker-compose.scraper-vpn.yml up -d")
        sys.exit(1)
    if is_vpn_connected():
        print("[VPN] Already connected")
        return

    print("[VPN] Not connected — connecting to France...")
    for attempt in range(3):
        try:
            subprocess.run([NORDVPN_CLI, "-c", "-g", "France"],
                           capture_output=True, timeout=30)
            time.sleep(5)
            if is_vpn_connected():
                print("[VPN] Connected to France")
                return
        except Exception as e:
            print(f"[VPN] Connection attempt {attempt + 1} failed: {e}")
            time.sleep(5)

    print("[VPN] FATAL: Could not connect to VPN after 3 attempts.")
    print("[VPN] Refusing to scrape without VPN to protect your IP.")
    sys.exit(1)


# ─── SQLite helpers ──────────────────────────────────────────────────────────

COLS = [
    "id", "source", "title", "price", "surface", "rooms", "city", "postalCode", "propertyKind",
    "listingType", "url", "imageUrl", "description", "scrapedAt", "pricePerSqm",
    "dpe", "ges", "charges", "floor", "hasElevator", "hasBalcony", "hasParking",
    "builtYear", "propertyTax", "isNew", "energyHeating", "heatingType",
    "bedrooms", "isFurnished", "hasCellar", "hasGarage", "terrain", "nbPhotos", "ownerType",
    "estimatedYield", "estimatedCashflow", "region",
]


def open_db() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = lbc_scrape.init_db(DB_FILE)
    for col, typ in [("region", "TEXT"), ("ownerType", "TEXT"),
                     ("estimatedYield", "REAL"), ("estimatedCashflow", "REAL")]:
        try:
            conn.execute(f"ALTER TABLE properties ADD COLUMN {col} {typ}")
            conn.commit()
        except sqlite3.OperationalError:
            pass
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_region ON properties(region)",
        "CREATE INDEX IF NOT EXISTS idx_pricePerSqm ON properties(pricePerSqm)",
        "CREATE INDEX IF NOT EXISTS idx_region_price ON properties(region, price)",
        "CREATE INDEX IF NOT EXISTS idx_listing_price ON properties(listingType, price)",
        "CREATE INDEX IF NOT EXISTS idx_region_listing ON properties(region, listingType)",
        "CREATE INDEX IF NOT EXISTS idx_listing_scraped ON properties(listingType, scrapedAt DESC)",
        "CREATE INDEX IF NOT EXISTS idx_listing_yield ON properties(listingType, estimatedYield DESC)",
        "CREATE INDEX IF NOT EXISTS idx_listing_cashflow ON properties(listingType, estimatedCashflow DESC)",
    ]:
        try:
            conn.execute(idx_sql)
        except Exception:
            pass
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA cache_size = -64000")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.commit()
    return conn


def upsert_properties(conn: sqlite3.Connection, props: list[dict]) -> int:
    if not props:
        return 0
    placeholders = ",".join("?" for _ in COLS)
    col_list = ", ".join(COLS)
    sql = f"INSERT OR REPLACE INTO properties ({col_list}) VALUES ({placeholders})"
    batch = [[p.get(c) for c in COLS] for p in props]
    conn.executemany(sql, batch)
    conn.commit()
    return len(batch)


def get_db_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM properties").fetchone()[0]


def print_db_stats(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM properties")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT id) FROM properties")
    distinct = cur.fetchone()[0]
    cur.execute("SELECT listingType, COUNT(*) FROM properties GROUP BY listingType")
    by_type = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT source, COUNT(*) FROM properties GROUP BY source")
    by_source = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT region, COUNT(*) FROM properties GROUP BY region ORDER BY COUNT(*) DESC LIMIT 5")
    top_regions = cur.fetchall()

    print(f"  Total in DB: {total:,} | Distinct: {distinct:,}")
    print(f"  By type: {by_type}")
    print(f"  By source: {by_source}")
    if top_regions:
        print(f"  Top regions: {[(r[0], r[1]) for r in top_regions]}")


# ─── LBC Progress tracking ──────────────────────────────────────────────────

def load_lbc_progress() -> dict:
    if os.path.isfile(LBC_PROGRESS_FILE):
        try:
            with open(LBC_PROGRESS_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_lbc_progress(data: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(LBC_PROGRESS_FILE, "w") as f:
        json.dump(data, f, indent=2)


PROPERTY_KINDS = ["apartment", "house"]


def progress_key(dept: str, listing_type: str, kind: str, tranche_idx: int) -> str:
    return f"{dept}_{listing_type}_{kind}_{tranche_idx}"


def count_total_tranches(listing_types: list[str]) -> int:
    n_depts = sum(len(codes) for codes in REGIONS.values())
    total = 0
    for lt in listing_types:
        total += n_depts * len(get_price_ranges(lt)) * len(PROPERTY_KINDS)
    return total


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — BIENVEO
# ═══════════════════════════════════════════════════════════════════════════════

def run_bienveo(conn: sqlite3.Connection, listing_types: list[str]) -> int:
    try:
        import bienveo_scrape
    except ImportError:
        print("[bienveo] bienveo_scrape.py not found, skipping.")
        return 0

    print("\n" + "=" * 60, flush=True)
    print(f"[{datetime.now().isoformat()}] Phase 1 — Bienveo (HLM)", flush=True)
    print("=" * 60, flush=True)

    total_inserted = 0
    print("[Bienveo] Creating session...", flush=True)
    session = bienveo_scrape.make_session()
    print("[Bienveo] Fetching pages...", flush=True)

    for listing_type in listing_types:
        transaction = "vente" if listing_type == "buy" else "location"
        for kind in ["appartement", "maison"]:
            slug = f"{transaction}-{kind}-france"
            page = 1
            slug_count = 0
            consecutive_errors = 0

            while slug_count < 5000:
                hits = bienveo_scrape.fetch_search_page(session, slug, page)
                if hits is None:
                    consecutive_errors += 1
                    if consecutive_errors >= 3:
                        break
                    time.sleep(5)
                    continue

                consecutive_errors = 0
                if not hits:
                    break

                batch = []
                for hit in hits:
                    norm = bienveo_scrape.normalize_hit(hit, listing_type)
                    if norm:
                        batch.append(norm)
                        slug_count += 1

                inserted = upsert_properties(conn, batch)
                total_inserted += inserted

                if len(hits) < 15:
                    break

                page += 1
                time.sleep(random.uniform(1.0, 2.5))

            print(f"  [bienveo] {slug}: {slug_count} ads", flush=True)

    print(f"  [bienveo] Total inserted: {total_inserted}", flush=True)
    return total_inserted


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — LEBONCOIN (incremental, resumable, VPN-aware)
# ═══════════════════════════════════════════════════════════════════════════════

def scrape_dept_tranche(session, dept_code: str, listing_type: str, kind: str,
                        price_min: int, price_max: int, req_count: int,
                        delay_min: float, delay_max: float):
    """Scrape all ads for one dept x kind x price tranche. Returns (ads, req_count, had_error)."""
    all_ads = []
    seen_ids: set = set()
    fetched = 0
    last_pivot = None
    total_in_search = None
    had_error = False

    while fetched < MAX_ADS_PER_SEARCH:
        batch_size = min(PAGE_SIZE, MAX_ADS_PER_SEARCH - fetched)
        use_offset = fetched if not last_pivot else 0
        if not last_pivot and fetched >= MAX_PER_SEARCH_OFFSET:
            break

        payload = lbc_scrape.build_payload(
            city_key=None, listing_type=listing_type, kind=kind,
            limit=batch_size, offset=use_offset,
            min_price=price_min, max_price=price_max,
            min_surface=None, department_code=dept_code,
            owner_type="all", pivot=last_pivot,
        )

        result = lbc_scrape.scrape_page(session, payload)
        req_count += 1

        if "error" in result:
            had_error = True
            break

        ads = result.get("ads") or []
        if not ads:
            break

        if total_in_search is None and "total" in result:
            total_in_search = result.get("total")

        for ad in ads:
            ad_id = ad.get("list_id") or ad.get("id")
            if ad_id and ad_id not in seen_ids:
                seen_ids.add(ad_id)
                norm = lbc_scrape.normalize_ad(ad, listing_type,
                    city_label=DEPARTMENTS.get(dept_code, dept_code))
                if norm:
                    all_ads.append(norm)

        fetched += len(ads)

        if total_in_search is not None and fetched >= total_in_search:
            break
        if len(ads) < batch_size:
            break

        next_pivot = result.get("pivot")
        if next_pivot and next_pivot != last_pivot:
            last_pivot = next_pivot
        else:
            last_pivot = None
            if fetched >= MAX_PER_SEARCH_OFFSET:
                break

        time.sleep(random.uniform(delay_min, delay_max))

    return all_ads, req_count, had_error


def dept_to_region(dept_code: str) -> str | None:
    for region_name, codes in REGIONS.items():
        if dept_code in codes:
            return region_name
    return None


def run_lbc(conn: sqlite3.Connection, listing_types: list[str],
            resume: bool, use_vpn: bool) -> int:
    """Scrape LeBonCoin incrementally. With VPN: rotate on block, no limit.
    Without VPN: exponential backoff, stop after MAX_BLOCK_ROUNDS."""

    delay_min = DELAY_MIN_VPN if use_vpn else DELAY_MIN_NORMAL
    delay_max = DELAY_MAX_VPN if use_vpn else DELAY_MAX_NORMAL
    session_rotate = SESSION_ROTATE_VPN if use_vpn else SESSION_ROTATE_NORMAL

    print("\n" + "=" * 60)
    print(f"[{datetime.now().isoformat()}] Phase 2 — LeBonCoin")
    print(f"  Mode: {'VPN rotation' if use_vpn else 'Standard (backoff)'}")
    print(f"  Types: {listing_types}")
    print(f"  Delays: {delay_min}-{delay_max}s | Session rotate every {session_rotate} reqs")
    print(f"  Resume: {'ON' if resume else 'OFF (fresh start)'}")
    print("=" * 60)

    progress = load_lbc_progress() if resume else {}
    if not resume:
        save_lbc_progress({})

    # Filter by region if PIPELINE_REGION is set (e.g. PIPELINE_REGION=Normandie)
    region_filter = (os.environ.get("PIPELINE_REGION") or "").strip()
    regions_to_use = REGIONS.items()
    if region_filter:
        if region_filter not in REGIONS:
            print(f"[ERROR] Unknown region '{region_filter}'. Valid: {list(REGIONS.keys())}")
            sys.exit(1)
        regions_to_use = [(region_filter, REGIONS[region_filter])]
        print(f"  Region filter: {region_filter} only")

    all_dept_codes = []
    for _, codes in regions_to_use:
        for c in codes:
            if c not in all_dept_codes:
                all_dept_codes.append(c)

    total_tranches = count_total_tranches(listing_types)
    total_inserted = 0
    total_requests = 0
    vpn_rotations = 0
    block_rounds = 0
    backoff_time = BACKOFF_INITIAL
    session = lbc_scrape.make_session()
    started_at = time.time()
    db_count_start = get_db_count(conn)
    last_progress_print = 0

    for dept_idx, dept_code in enumerate(all_dept_codes):
        # Non-VPN mode: stop after too many blocks
        if not use_vpn and block_rounds >= MAX_BLOCK_ROUNDS:
            print(f"\n--> Too many blocks ({MAX_BLOCK_ROUNDS}). Stopping. Resume next run.")
            break

        region_name = dept_to_region(dept_code) or "Unknown"

        for listing_type in listing_types:
            price_ranges = get_price_ranges(listing_type)
            type_label = "Achat" if listing_type == "buy" else "Location"

            for kind in PROPERTY_KINDS:
                for tranche_idx, (price_min, price_max) in enumerate(price_ranges):
                    pkey = progress_key(dept_code, listing_type, kind, tranche_idx)
                    if resume and pkey in progress:
                        continue

                    range_label = f"{price_min // 1000}k-{price_max // 1000}k"

                    ads, total_requests, had_error = scrape_dept_tranche(
                        session, dept_code, listing_type, kind,
                        price_min, price_max, total_requests,
                        delay_min, delay_max,
                    )

                    if had_error:
                        if use_vpn:
                            vpn_rotations += 1
                            rotate_vpn()
                            session = lbc_scrape.make_session()
                            continue
                        else:
                            block_rounds += 1
                            print(f"    [!] Block #{block_rounds} — backoff {backoff_time}s")
                            time.sleep(backoff_time)
                            backoff_time = min(backoff_time * BACKOFF_MULTIPLIER, BACKOFF_MAX)
                            session = lbc_scrape.make_session()
                            if block_rounds >= MAX_BLOCK_ROUNDS:
                                break
                            continue
                    else:
                        block_rounds = 0
                        backoff_time = BACKOFF_INITIAL

                    if ads:
                        for ad in ads:
                            ad["region"] = region_name
                        inserted = upsert_properties(conn, ads)
                        total_inserted += inserted

                        if inserted > 0:
                            print(f"    {dept_code} {type_label} {kind[:3]} {range_label}: +{inserted} (total: {total_inserted})")

                    progress[pkey] = {"count": len(ads), "ts": datetime.now().isoformat()}

                    if total_requests % session_rotate == 0 and total_requests > 0:
                        session = lbc_scrape.make_session()

                    if ads:
                        time.sleep(random.uniform(delay_min, delay_max))

                    if total_inserted - last_progress_print >= 5000:
                        last_progress_print = total_inserted
                        elapsed = time.time() - started_at
                        done_pct = len(progress) / max(total_tranches, 1) * 100
                        db_total = db_count_start + total_inserted
                        rate = total_inserted / max(elapsed, 1) * 3600
                        remaining = (total_tranches - len(progress)) / max(len(progress), 1) * elapsed
                        print(f"\n  [Progress] {db_total:,} in DB | +{total_inserted:,} this run | "
                              f"{done_pct:.1f}% tranches | {total_requests} reqs | "
                              f"{vpn_rotations} VPN rotations | "
                              f"~{rate:,.0f} ads/h | ETA: ~{int(remaining // 60)}m\n")

                if not use_vpn and block_rounds >= MAX_BLOCK_ROUNDS:
                    break

            if not use_vpn and block_rounds >= MAX_BLOCK_ROUNDS:
                break

        save_lbc_progress(progress)

    save_lbc_progress(progress)

    elapsed = time.time() - started_at
    h, m, s = int(elapsed // 3600), int((elapsed % 3600) // 60), int(elapsed % 60)
    print(f"\n  LBC done: +{total_inserted:,} ads, {total_requests} reqs, "
          f"{h}h{m}m{s}s, {vpn_rotations} VPN rotations")

    return total_inserted


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN (with auto-retry + auto-shutdown)
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("[Pipeline] Starting...", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()

    parser = argparse.ArgumentParser(description="Pipeline: Bienveo + LBC scraper")
    parser.add_argument("--bienveo-only", action="store_true", help="Run Bienveo only")
    parser.add_argument("--lbc-only", action="store_true", help="Run LBC only")
    parser.add_argument("--no-vpn", action="store_true", help="DANGEROUS: skip VPN (exposes personal IP)")
    parser.add_argument("--shutdown", action="store_true", help="Shutdown PC when scraping is done")
    args = parser.parse_args()

    use_vpn = not args.no_vpn

    mode = os.environ.get("PIPELINE_MODE", "buy,rent").strip()
    listing_types = [t.strip() for t in mode.split(",") if t.strip() in ("buy", "rent")]
    if not listing_types:
        listing_types = ["buy", "rent"]

    resume = os.environ.get("LBC_RESUME", "1") != "0"
    run_bienveo_phase = not args.lbc_only
    run_lbc_phase = not args.bienveo_only

    # VPN is mandatory by default — protects personal IP
    print(f"[Pipeline] Mode: bienveo={run_bienveo_phase}, lbc={run_lbc_phase}, vpn={use_vpn}", flush=True)
    if use_vpn:
        ensure_vpn_connected()
    else:
        print("[!] WARNING: Running WITHOUT VPN — your personal IP is exposed!", flush=True)

    prevent_sleep()

    conn = open_db()
    started_at = time.time()

    # ─── Phase 0: Mortgage rates ─────────────────────────────────────────
    print("\n" + "=" * 60, flush=True)
    print(f"[{datetime.now().isoformat()}] Phase 0 — Mortgage Rates (CAFPI)", flush=True)
    print("=" * 60)
    try:
        rate_data = rates_scrape.run(DB_FILE)
        if rate_data.get("national"):
            print(f"  Rates OK: {rate_data['national']}")
        else:
            print("  WARNING: Could not fetch live rates — will use cached/fallback")
    except Exception as e:
        print(f"  WARNING: Rate scraping failed: {e} — continuing with cached/fallback")

    # ─── Phase 1: Bienveo ────────────────────────────────────────────────
    if run_bienveo_phase:
        if use_vpn and not is_vpn_connected():
            ensure_vpn_connected()
        run_bienveo(conn, listing_types)

    # ─── Phase 2: LBC (with auto-retry on crash) ────────────────────────
    if run_lbc_phase:
        max_retries = 50
        for attempt in range(1, max_retries + 1):
            try:
                if use_vpn and not is_vpn_connected():
                    ensure_vpn_connected()
                run_lbc(conn, listing_types, resume=True, use_vpn=use_vpn)
                break
            except KeyboardInterrupt:
                print("\n[!] Interrupted by user. Progress saved.")
                break
            except Exception as e:
                print(f"\n[!] Crash on attempt {attempt}/{max_retries}: {e}")
                traceback.print_exc()
                if attempt < max_retries:
                    print(f"    Retrying in 30s...")
                    time.sleep(30)
                    rotate_vpn()
                    conn.close()
                    conn = open_db()
                else:
                    print("[!] Max retries reached.")

    # ─── Final stats ─────────────────────────────────────────────────────
    try:
        conn.execute("ANALYZE")
        conn.commit()
    except Exception:
        pass

    elapsed = time.time() - started_at
    h, m, s = int(elapsed // 3600), int((elapsed % 3600) // 60), int(elapsed % 60)

    print("\n" + "=" * 60)
    print(f"[{datetime.now().isoformat()}] Pipeline complete — {h}h {m}m {s}s")
    print_db_stats(conn)
    print("=" * 60)

    conn.close()

    allow_sleep()

    # ─── Auto-shutdown ───────────────────────────────────────────────────
    if args.shutdown:
        print("\n>>> Computer will shut down in 60 seconds. Close this window to cancel.")
        if platform.system() == "Windows":
            subprocess.run(["shutdown", "/s", "/t", "60"])
        else:
            subprocess.run(["shutdown", "-h", "+1"], capture_output=True)


if __name__ == "__main__":
    main()
