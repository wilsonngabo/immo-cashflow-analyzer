"""Shared HTTP session with TLS impersonation and optional proxy."""

import os
import random

IMPERSONATE_OPTIONS = ["chrome110", "chrome107", "chrome104", "edge101"]


def get_proxies() -> dict | None:
    """Proxy from env (LBC_PROXY or HTTPS_PROXY) for Datadome bypass."""
    p = os.environ.get("LBC_PROXY") or os.environ.get("HTTPS_PROXY")
    if not p:
        return None
    return {"https": p, "http": p}


def make_session(impersonate: str | None = None):
    """Session with TLS impersonation and optional proxy. Requires curl_cffi."""
    from curl_cffi import requests as cf_requests

    imp = impersonate or random.choice(IMPERSONATE_OPTIONS)
    proxies = get_proxies()
    if proxies:
        return cf_requests.Session(impersonate=imp, proxies=proxies)
    return cf_requests.Session(impersonate=imp)
