"""Fetch the club's data from EA and write one payload for the site's /api/ingest.

EA's bot filter rejects clients whose connection fingerprint doesn't match the
browser they claim to be, so this uses curl_cffi to connect exactly like Chrome.

Usage: python scripts/fetch-ea.py payload.json
Env:   CLUB_ID (default 837026), PLATFORM (default common-gen5)
"""

import json
import os
import sys
import time
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
    # EA's edge servers cache identical requests for minutes; ask for a fresh answer
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}
working_profile = None


def fetch(name, path, params, optional=False):
    """Returns parsed JSON, or None after logging why it failed."""
    global working_profile
    # a unique stamp per request, so a cached copy (missing the latest game) is never served
    stamp = int(time.time() * 1000)
    url = f"{BASE}/{path}?{urllib.parse.urlencode({'platform': PLATFORM, **params, '_': stamp})}"
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

# opponents' Skill Rating for games from the last few hours, saved with the match
recent = time.time() - 3 * 3600
opponent_ids = sorted({
    club for kind in ("leagueMatch", "playoffMatch") for m in payload["matches"].get(kind) or []
    if int(m.get("timestamp", 0)) > recent for club in m.get("clubs", {}) if club != CLUB_ID
})
payload["opponents"] = {}
for opp in opponent_ids:
    data = fetch(f"opponent {opp}", "clubs/overallStats", {"clubIds": opp}, optional=True)
    if data:
        payload["opponents"][opp] = {"skillRating": data[0].get("skillRating")}

club_name = (payload.get("info") or {}).get(CLUB_ID, {}).get("name") or "Sarma gang"
search = fetch("search", "allTimeLeaderboard/search", {"clubName": club_name})
if search is not None:
    payload["search"] = search

payload["source"] = f"github-actions, {working_profile}"
payload["errors"] = errors
with open(sys.argv[1] if len(sys.argv) > 1 else "payload.json", "w") as f:
    json.dump(payload, f)
print(f"payload ready: {len(league)} league matches, {len(errors)} problem(s)")
