"""
Seed 15 curated opportunity sources into the database.
"""

import logging

from sqlalchemy.orm import Session

from app.models.source import Source

logger = logging.getLogger(__name__)

SEED_SOURCES: list[dict] = [
    # --- JS-heavy sites (crawl4ai) — scroll_mode: "full_page" for infinite-scroll listings ---
    {
        "name": "Devfolio Hackathons",
        "base_url": "https://devfolio.co",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://devfolio.co/hackathons",
            "notes": "India's largest hackathon platform",
            "scroll_mode": "full_page",
            "max_scroll_steps": 3,
            "scroll_delay": 0.5,
        },
    },
    {
        "name": "Unstop Competitions",
        "base_url": "https://unstop.com",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://unstop.com/competitions?oppstatus=open",
            "notes": "Formerly Dare2Compete — competitions, quizzes, hackathons",
            "scroll_mode": "full_page",
            "scroll_steps_per_page": 10,
            "scroll_delay": 1.5,
            "delay_before_return_html": 2,
            "remove_overlay_elements": True,
            "magic": True,
            "js_code": "document.querySelector('[id*=\"cookie\"], [class*=\"cookie\"], [data-testid*=\"cookie\"]')?.querySelector('button, [role=button], a')?.click();",
        },
    },
    {
        "name": "Unstop Hackathons",
        "base_url": "https://unstop.com/hackathons",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://unstop.com/hackathons?oppstatus=open",
            "notes": "Hackathon-specific listing on Unstop",
            "scroll_mode": "full_page",
            "scroll_steps_per_page": 10,
            "scroll_delay": 1.5,
            "delay_before_return_html": 2,
            "remove_overlay_elements": True,
            "magic": True,
            "js_code": "document.querySelector('[id*=\"cookie\"], [class*=\"cookie\"], [data-testid*=\"cookie\"]')?.querySelector('button, [role=button], a')?.click();",
        },
    },
    {
        "name": "MLH Hackathons",
        "base_url": "https://mlh.io",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://mlh.io/seasons/2026/events",
            "notes": "Major League Hacking — global student hackathons",
            "scroll_mode": "full_page",
            "max_scroll_steps": 3,
            "scroll_delay": 0.5,
        },
    },
    {
        "name": "Internshala Internships",
        "base_url": "https://internshala.com",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://internshala.com/internships",
            "notes": "India's top internship platform",
            "scroll_mode": "full_page",
            "max_scroll_steps": 3,
            "scroll_delay": 0.6,
        },
    },
    {
        "name": "Google Summer of Code",
        "base_url": "https://summerofcode.withgoogle.com",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://summerofcode.withgoogle.com/programs/2026",
            "notes": "GSoC — open source mentoring for students",
        },
    },
    {
        "name": "Startup India",
        "base_url": "https://www.startupindia.gov.in",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://www.startupindia.gov.in/content/sih/en/government-schemes.html",
            "notes": "Government startup programs and schemes",
        },
    },
    {
        "name": "Atal Innovation Mission",
        "base_url": "https://aim.gov.in",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://aim.gov.in/",
            "notes": "NITI Aayog innovation programs for students and startups",
        },
    },
    {
        "name": "E-Yantra IIT Bombay",
        "base_url": "https://www.e-yantra.org",
        "scraper_type": "crawl4ai",
        "config": {
            "listing_url": "https://www.e-yantra.org/",
            "notes": "Robotics competitions and labs by IIT Bombay",
        },
    },
    # --- Static HTML sites (httpx) ---
    {
        "name": "Smart India Hackathon",
        "base_url": "https://www.sih.gov.in",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://www.sih.gov.in/",
            "notes": "India's largest national hackathon by AICTE/MoE",
        },
    },
    {
        "name": "DST INSPIRE Fellowships",
        "base_url": "https://online-inspire.gov.in",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://online-inspire.gov.in/",
            "notes": "Dept of Science & Technology research fellowships",
        },
    },
    {
        "name": "UGC Fellowships",
        "base_url": "https://www.ugc.gov.in",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://www.ugc.gov.in/Fellowship",
            "notes": "University Grants Commission fellowship listings",
            "pagination": True,
            "max_pages": 3,
            "page_param": "page",
        },
    },
    {
        "name": "SERB Research Grants",
        "base_url": "https://serb.gov.in",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://serb.gov.in/page/english/awards_fellowship",
            "notes": "Science and Engineering Research Board programs",
            "pagination": True,
            "max_pages": 3,
            "page_param": "page",
        },
    },
    {
        "name": "AICTE Programs",
        "base_url": "https://www.aicte-india.org",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://www.aicte-india.org/schemes",
            "notes": "AICTE student development schemes",
            "pagination": True,
            "max_pages": 3,
        },
    },
    {
        "name": "FOSSEE IIT Bombay",
        "base_url": "https://fossee.in",
        "scraper_type": "html",
        "config": {
            "listing_url": "https://fossee.in/",
            "notes": "Free/open-source software internships and fellowships",
        },
    },
]


# Sources enabled by default — start with one, enable more as you validate
ENABLED_BY_DEFAULT = {
    "https://unstop.com",
}


def seed_sources(db: Session) -> int:
    """Insert seed sources, skipping any that already exist (by base_url)."""
    existing_urls = {s.base_url for s in db.query(Source.base_url).all()}
    added = 0

    for data in SEED_SOURCES:
        if data["base_url"] in existing_urls:
            logger.info(f"  Skipping (exists): {data['name']}")
            continue

        enabled = data["base_url"] in ENABLED_BY_DEFAULT
        source = Source(
            name=data["name"],
            base_url=data["base_url"],
            scraper_type=data["scraper_type"],
            config=data["config"],
            is_enabled=enabled,
        )
        db.add(source)
        added += 1
        status = "enabled" if enabled else "disabled"
        logger.info(f"  Added ({status}): {data['name']}")

    db.commit()
    enabled_count = len(ENABLED_BY_DEFAULT)
    logger.info(
        f"Seeded {added} new sources ({enabled_count} enabled, "
        f"{len(SEED_SOURCES) - added} already existed)"
    )
    return added
