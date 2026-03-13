"""VPN management: Gluetun proxy, host NordVPN, or Docker NordVPN (tmknight)."""

import os
import sys
import subprocess
import time

SCRAPER_VPN_PROXY = os.environ.get("SCRAPER_VPN_PROXY", "http://localhost:8888").strip()
SCRAPER_VPN_CONTAINER = os.environ.get("SCRAPER_VPN_CONTAINER", "gluetun-scraper").strip()
SCRAPER_VPN_DOCKER_NORDVPN_CONTAINER = os.environ.get(
    "SCRAPER_VPN_DOCKER_NORDVPN_CONTAINER", "nordvpn-scraper"
).strip()

NORDVPN_CLI = os.environ.get("NORDVPN_CLI", "nordvpn")


def use_proxy_vpn() -> bool:
    """Use Gluetun proxy (does not affect Plex) instead of host NordVPN."""
    return os.environ.get("SCRAPER_VPN_PROXY_MODE", "0") in ("1", "true", "yes")


def use_docker_nordvpn() -> bool:
    """Scraper runs inside tmknight NordVPN container; rotate via docker exec."""
    return os.environ.get("SCRAPER_VPN_DOCKER_NORDVPN", "0") in ("1", "true", "yes")


def _docker_cmd() -> list[str]:
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
            project_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
    country = os.environ.get("SCRAPER_VPN_CONNECT_COUNTRY", "France").strip()
    print(f"    [VPN] Rotating: docker exec {container} nordvpn disconnect + connect {country}")
    try:
        import docker as docker_module
        client = docker_module.from_env()
        nordvpn = client.containers.get(container)
        nordvpn.exec_run("nordvpn disconnect", detach=False)
        time.sleep(5)
        nordvpn.exec_run(f"nordvpn connect {country}", detach=False)
        time.sleep(15)  # Laisser le VPN se stabiliser avant de retry
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
        return True
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
        output = (result.stdout or "") + (result.stderr or "")
        output = output.lower()
        return "connected" in output and "disconnected" not in output
    except Exception:
        return False


def ensure_vpn_connected() -> None:
    """Make sure VPN is ready. Proxy: start Gluetun. Docker NordVPN: no-op. Host: connect NordVPN to France."""
    if use_docker_nordvpn():
        return
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
