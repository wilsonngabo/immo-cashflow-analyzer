"""Power management: prevent sleep during long scraping (Linux/macOS: no-op)."""


def prevent_sleep() -> None:
    """Tell OS to stay awake while scraping. No-op on Linux (not needed for headless)."""
    pass


def allow_sleep() -> None:
    """Re-enable normal OS sleep behavior. No-op on Linux."""
    pass
