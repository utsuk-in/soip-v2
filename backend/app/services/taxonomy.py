"""Canonical taxonomy for domains and categories with synonym normalization."""

from __future__ import annotations

from typing import Iterable

CANONICAL_DOMAINS = {
    "ai",
    "ml",
    "data",
    "robotics",
    "web",
    "mobile",
    "cloud",
    "security",
    "blockchain",
    "fintech",
    "health",
    "climate",
    "education",
    "social-impact",
    "design",
    "product",
    "startup",
    "research",
    "hardware",
    "iot",
    "general",
    "online",
    "offline",
}

# Map synonyms/variants -> canonical domain
DOMAIN_SYNONYMS = {
    "artificial intelligence": "ai",
    "ai": "ai",
    "machine learning": "ml",
    "ml": "ml",
    "deep learning": "ml",
    "data science": "data",
    "data": "data",
    "analytics": "data",
    "robot": "robotics",
    "robotics": "robotics",
    "web development": "web",
    "webdev": "web",
    "web": "web",
    "frontend": "web",
    "backend": "web",
    "fullstack": "web",
    "mobile": "mobile",
    "android": "mobile",
    "ios": "mobile",
    "cloud": "cloud",
    "devops": "cloud",
    "cybersecurity": "security",
    "security": "security",
    "infosec": "security",
    "blockchain": "blockchain",
    "web3": "blockchain",
    "crypto": "blockchain",
    "fintech": "fintech",
    "finance": "fintech",
    "health": "health",
    "healthcare": "health",
    "medtech": "health",
    "biotech": "health",
    "climate": "climate",
    "sustainability": "climate",
    "green": "climate",
    "education": "education",
    "edtech": "education",
    "social impact": "social-impact",
    "social-impact": "social-impact",
    "impact": "social-impact",
    "design": "design",
    "ux": "design",
    "ui": "design",
    "product": "product",
    "product management": "product",
    "startup": "startup",
    "entrepreneurship": "startup",
    "research": "research",
    "hardware": "hardware",
    "iot": "iot",
    "internet of things": "iot",
    "online": "online",
    "offline": "offline",
    "general": "general",
}


def normalize_domains(values: Iterable[str] | None) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if raw is None:
            continue
        val = str(raw).strip().lower()
        if not val:
            continue
        canonical = DOMAIN_SYNONYMS.get(val)
        if not canonical and val in CANONICAL_DOMAINS:
            canonical = val
        if not canonical:
            # try to normalize spacing/slug
            val = val.replace("_", " ").replace("-", " ").strip()
            canonical = DOMAIN_SYNONYMS.get(val)
        if not canonical:
            continue
        if canonical not in seen:
            seen.add(canonical)
            out.append(canonical)
    return out
