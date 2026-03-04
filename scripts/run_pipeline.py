#!/usr/bin/env python3
"""
Lance la pipeline (par région, tranches 25k€, Parquet → SQLite).
Affiche en fin la durée totale et le nombre de listings.

Usage:
    python scripts/run_pipeline.py
"""
import sys
import os

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from pipeline import main
    main()
