"""Shared configuration: paths, constants."""

import os

_SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = os.path.dirname(_SCRIPTS_DIR)

DATA_DIR = os.path.join(_PROJECT_ROOT, "data")
DB_FILE = os.environ.get("DB_FILE") or os.path.join(DATA_DIR, "properties.db")
LBC_PROGRESS_FILE = os.environ.get("LBC_PROGRESS_FILE") or os.path.join(
    DATA_DIR, "lbc_progress.json"
)
