"""Fetch the club's data from EA and write one payload for the site's /api/ingest.

EA's bot filter rejects clients whose connection fingerprint doesn't match the
browser they claim to be, so this uses curl_cffi to connect exactly like Chrome.

Usage: python scripts/fetch-ea.py payload.json
Env:   CLUB_ID (default 837026), PLATFORM (default common-gen5)
"""

import json
import os
import sys
import urllib.parse

from curl_cffi import requests

CLUB_ID = os.environ.get("CLUB_ID", "837026")
PLATFORM = os.environ.get("PLATFORM", "common-gen5")
BASE = "https://proclubs.ea.com/api/fc"
# newest first; older profiles kept as fallbacks in case EA starts rejecting one
PROFILES = ["chrome", "chrome131", "safari", "edge"]

session = requests.Session()
headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.ea.com/",
    "Origin": "https://www.ea.com",
}
working_profile = None


def fetch(name, path, params, optional=False):
    """Returns parsed JSON, or None after logging why it failed."""
    global working_profile
    url = f"{BASE}/{path}?{urllib.parse.urlencode({'platform': PLATFORM, **params})}"
    profiles = [working_profile] if working_profile else PROFILES
    last = ""
    for profile in profiles:
        try:
            res = session.get(url, headers=headers, impersonate=profile, timeout=15)
            if res.status_code == 200:
                data = res.json()
                working_profile = profile
                print(f"{name}: ok ({profile})")
                return data
            last = f"HTTP {res.status_code}"
        except Exception as exc:  # timeouts, resets, bad JSON
            last = type(exc).__name__
        print(f"{name}: {last} ({profile})")
    if not optional:
        errors.append(f"{name}: {last}")
    return None


errors = []
payload = {"matches": {}}

league = fetch("leagueMatch", "clubs/matches", {"clubIds": CLUB_ID, "matchType": "leagueMatch", "maxResultCount": 10})
if league is None:
    print(f"::error::EA refused this runner: {'; '.join(errors)}")
    sys.exit(1)
payload["matches"]["leagueMatch"] = league

for match_type in ("playoffMatch", "friendlyMatch"):
    data = fetch(match_type, "clubs/matches", {"clubIds": CLUB_ID, "matchType": match_type, "maxResultCount": 10}, optional=True)
    if data is not None:
        payload["matches"][match_type] = data

for key, path, params in (
    ("info", "clubs/info", {"clubIds": CLUB_ID}),
    ("overall", "clubs/overallStats", {"clubIds": CLUB_ID}),
    ("members", "members/stats", {"clubId": CLUB_ID}),
    ("career", "members/career/stats", {"clubId": CLUB_ID}),
):
    data = fetch(key, path, params)
    if data is not None:
        payload[key] = data

club_name = (payload.get("info") or {}).get(CLUB_ID, {}).get("name") or "Sarma gang"
search = fetch("search", "allTimeLeaderboard/search", {"clubName": club_name})
if search is not None:
    payload["search"] = search

payload["source"] = f"github-actions, {working_profile}"
payload["errors"] = errors
with open(sys.argv[1] if len(sys.argv) > 1 else "payload.json", "w") as f:
    json.dump(payload, f)
print(f"payload ready: {len(league)} league matches, {len(errors)} problem(s)")
