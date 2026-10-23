"""Fetches one club's data from EA as the payload the site's /api/ingest takes.

Shared by the regular check (scripts/fetch-ea.py, run by GitHub Actions) and the first load on
/setup (api/ea-fetch.py, a Vercel function). EA's bot filter rejects clients whose connection
fingerprint doesn't match the browser they claim to be, so this uses curl_cffi to connect
exactly like Chrome. Files starting with "_" in api/ are not routes on Vercel.
"""

import time
import urllib.parse

from curl_cffi import requests

BASE = "https://proclubs.ea.com/api/fc"
# newest first; older profiles kept as fallbacks in case EA starts rejecting one
PROFILES = ["chrome", "chrome131", "safari", "edge"]
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.ea.com/",
    "Origin": "https://www.ea.com",
    # EA's edge servers cache identical requests for minutes; ask for a fresh answer
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


class _Fetcher:
    def __init__(self, platform, log):
        self.platform = platform
        self.log = log
        self.session = requests.Session()
        self.profile = None
        self.errors = []

    def get(self, name, path, params, optional=False):
        """Returns parsed JSON, or None after logging why it failed."""
        # a unique stamp per request, so a cached copy (missing the latest game) is never served
        stamp = int(time.time() * 1000)
        url = f"{BASE}/{path}?{urllib.parse.urlencode({'platform': self.platform, **params, '_': stamp})}"
        last = ""
        for profile in [self.profile] if self.profile else PROFILES:
            try:
                res = self.session.get(url, headers=HEADERS, impersonate=profile, timeout=15)
                if res.status_code == 200:
                    data = res.json()
                    self.profile = profile
                    self.log(f"{name}: ok ({profile})")
                    return data
                last = f"HTTP {res.status_code}"
            except Exception as exc:  # timeouts, resets, bad JSON
                last = type(exc).__name__
            self.log(f"{name}: {last} ({profile})")
        if not optional:
            self.errors.append(f"{name}: {last}")
        return None


def build_payload(club_id, platform, source, log=print):
    """The ingest payload for one club, or None when EA refused even the league games."""
    f = _Fetcher(platform, log)
    payload = {"matches": {}}

    league = f.get("leagueMatch", "clubs/matches", {"clubIds": club_id, "matchType": "leagueMatch", "maxResultCount": 10})
    if league is None:
        return None, f.errors
    payload["matches"]["leagueMatch"] = league

    for match_type in ("playoffMatch", "friendlyMatch"):
        data = f.get(match_type, "clubs/matches", {"clubIds": club_id, "matchType": match_type, "maxResultCount": 10}, optional=True)
        if data is not None:
            payload["matches"][match_type] = data

    for key, path, params in (
        ("info", "clubs/info", {"clubIds": club_id}),
        ("overall", "clubs/overallStats", {"clubIds": club_id}),
        ("members", "members/stats", {"clubId": club_id}),
        ("career", "members/career/stats", {"clubId": club_id}),
    ):
        data = f.get(key, path, params)
        if data is not None:
            payload[key] = data

    # opponents' Skill Rating for games from the last few hours, saved with the match
    recent = time.time() - 3 * 3600
    opponent_ids = sorted({
        club for kind in ("leagueMatch", "playoffMatch") for m in payload["matches"].get(kind) or []
        if int(m.get("timestamp", 0)) > recent for club in m.get("clubs", {}) if club != club_id
    })
    payload["opponents"] = {}
    for opp in opponent_ids:
        data = f.get(f"opponent {opp}", "clubs/overallStats", {"clubIds": opp}, optional=True)
        if data:
            payload["opponents"][opp] = {"skillRating": data[0].get("skillRating")}

    club_name = (payload.get("info") or {}).get(club_id, {}).get("name") or ""
    if club_name:
        search = f.get("search", "allTimeLeaderboard/search", {"clubName": club_name})
        if search is not None:
            payload["search"] = search

    # the top 100 clubs by Skill Rating; changes slowly, so a failure here isn't an error
    top = f.get("leaderboard", "allTimeLeaderboard", {}, optional=True)
    if top is not None:
        payload["leaderboard"] = top

    payload["source"] = f"{source}, {f.profile}"
    payload["errors"] = f.errors
    return payload, f.errors
