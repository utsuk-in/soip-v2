"""
Scraping and extraction pipeline.

Usage:
    python -m app.services.scraper              # run full pipeline
    python -m app.services.scraper --seed-only  # seed sources only
"""

from app.services.scraper.client import scrape_source
from app.services.scraper.extractor import ExtractedOpportunity, extract_opportunities
from app.services.scraper.pipeline import run_pipeline
from app.services.scraper.seed import seed_sources

__all__ = [
    "scrape_source",
    "extract_opportunities",
    "ExtractedOpportunity",
    "run_pipeline",
    "seed_sources",
]
