"""Canonical first-party hosted origin and social-preview metadata (portable is independent)."""
from __future__ import annotations

import json
import re
import struct
from html import escape
from pathlib import Path
from urllib.parse import urljoin, urlsplit

OG_DIMENSIONS = (1200, 630)
SITE_CONFIG = "hosted-site.json"


def jpeg_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 4 or not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Invalid hosted OG JPEG signature")
    offset = 2
    while offset < len(data):
        if data[offset] != 0xFF:
            raise ValueError("Invalid hosted OG JPEG marker")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            raise ValueError("Truncated hosted OG JPEG")
        marker = data[offset]
        offset += 1
        if marker in (1, *range(0xD0, 0xD9)):
            continue
        if offset + 2 > len(data):
            raise ValueError("Truncated hosted OG JPEG segment")
        size = struct.unpack_from(">H", data, offset)[0]
        if size < 2 or offset + size > len(data):
            raise ValueError("Invalid hosted OG JPEG segment")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if size < 7:
                raise ValueError("Invalid hosted OG JPEG frame")
            height, width = struct.unpack_from(">HH", data, offset + 3)
            return width, height
        offset += size
    raise ValueError("Missing hosted OG JPEG dimensions")


def load_hosted_site(branding: Path) -> dict:
    config = branding / SITE_CONFIG
    if not config.is_file():
        raise ValueError(f"Missing hosted site configuration: {config}")
    try:
        site = json.loads(config.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f"Invalid hosted-site.json: {exc}") from exc
    if not isinstance(site, dict):
        raise ValueError("Hosted site configuration must be an object")
    if set(site) != {"origin", "title", "description", "locale", "image", "image_alt"}:
        raise ValueError("Unknown or missing hosted site configuration keys")
    origin = site["origin"]
    if not isinstance(origin, str):
        raise ValueError("Hosted origin must be an HTTPS root URL")
    url = urlsplit(origin)
    if not (url.scheme == "https" and url.hostname and origin == f"https://{url.hostname}/"
            and not url.username and not url.password and url.port is None):
        raise ValueError("Hosted origin must be an HTTPS root URL")
    for name in ("title", "description", "locale", "image_alt"):
        if not isinstance(site[name], str) or not site[name].strip():
            raise ValueError(f"Missing hosted social field: {name}")
    if not re.fullmatch(r"[a-z]{2}_[A-Z]{2}", site["locale"]):
        raise ValueError("Invalid hosted Open Graph locale")
    image = site["image"]
    if not isinstance(image, str) or not re.fullmatch(r"og/[A-Za-z0-9][A-Za-z0-9._-]*\.jpg", image):
        raise ValueError("Hosted OG image must be a local JPEG under og/")
    image_file = branding / image
    if not image_file.is_file():
        raise ValueError(f"Missing hosted OG image: {image_file}")
    if jpeg_dimensions(image_file.read_bytes()) != OG_DIMENSIONS:
        raise ValueError(f"Hosted OG image dimensions must be {OG_DIMENSIONS}")
    return site


def social_metadata(site: dict) -> str:
    origin = escape(site["origin"], quote=True)
    title = escape(site["title"], quote=True)
    description = escape(site["description"], quote=True)
    locale = escape(site["locale"], quote=True)
    alt = escape(site["image_alt"], quote=True)
    image = escape(urljoin(site["origin"], site["image"]), quote=True)
    return "\n  ".join([
        f'<link rel="canonical" href="{origin}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Auralprint">',
        f'<meta property="og:locale" content="{locale}">',
        f'<meta property="og:url" content="{origin}">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{description}">',
        f'<meta property="og:image" content="{image}">',
        f'<meta property="og:image:secure_url" content="{image}">',
        '<meta property="og:image:type" content="image/jpeg">',
        f'<meta property="og:image:width" content="{OG_DIMENSIONS[0]}">',
        f'<meta property="og:image:height" content="{OG_DIMENSIONS[1]}">',
        f'<meta property="og:image:alt" content="{alt}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{title}">',
        f'<meta name="twitter:description" content="{description}">',
        f'<meta name="twitter:image" content="{image}">',
        f'<meta name="twitter:image:alt" content="{alt}">',
    ])
