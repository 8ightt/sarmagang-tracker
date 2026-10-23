"""Fetch the club's data from EA and write one payload for the site's /api/ingest.

The fetching itself lives in api/_eafetch.py, shared with the first load on /setup.

Usage: python scripts/fetch-ea.py payload.json
Env:   CLUB_ID and PLATFORM, or SITE_URL to ask the site which club it follows (/api/club)
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api"))

from curl_cffi import requests  # noqa: E402
from _eafetch import build_payload  # noqa: E402

club_id = os.environ.get("CLUB_ID", "").strip()
platform = os.environ.get("PLATFORM", "").strip()
site = os.environ.get("SITE_URL", "").strip().rstrip("/")
if not club_id and site:
    # the club picked on the site's setup screen
    club = requests.get(f"{site}/api/club", timeout=20).json()
    club_id, platform = str(club.get("id") or ""), platform or club.get("platform") or ""
if not club_id:
    print("::error::No club yet: finish /setup on the site, or set CLUB_ID.")
    sys.exit(1)

payload, errors = build_payload(club_id, platform or "common-gen5", "github-actions")
if payload is None:
    print(f"::error::EA refused this runner: {'; '.join(errors)}")
    sys.exit(1)
with open(sys.argv[1] if len(sys.argv) > 1 else "payload.json", "w") as f:
    json.dump(payload, f)
print(f"payload ready: {len(payload['matches']['leagueMatch'])} league matches, {len(errors)} problem(s)")
