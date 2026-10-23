"""Club search for the setup screen: /api/ea-search?name=<club name>&platform=common-gen5

EA's bot filter rejects clients whose connection fingerprint doesn't match a browser, so this
connects like Chrome (curl_cffi), the same way scripts/fetch-ea.py does for the regular check.
Read-only, one EA call per request, and only EA's club search.
"""

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from curl_cffi import requests

BASE = "https://proclubs.ea.com/api/fc"
PLATFORMS = {"common-gen5", "common-gen4", "nx"}
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.ea.com/",
    "Origin": "https://www.ea.com",
}


class handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, s-maxage=60")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get("name") or [""])[0].strip()[:40]
        platform = (q.get("platform") or ["common-gen5"])[0]
        if len(name) < 2:
            return self.reply(400, {"error": "Type at least 2 letters of the club name."})
        if platform not in PLATFORMS:
            return self.reply(400, {"error": "Unknown platform."})
        try:
            res = requests.get(
                f"{BASE}/allTimeLeaderboard/search",
                params={"platform": platform, "clubName": name},
                headers=HEADERS,
                impersonate="chrome",
                timeout=12,
            )
        except Exception as err:  # network trouble: say so instead of a stack trace
            return self.reply(502, {"error": f"EA didn't answer: {type(err).__name__}"})
        if res.status_code != 200:
            return self.reply(502, {"error": f"EA answered HTTP {res.status_code}", "eaStatus": res.status_code})
        try:
            clubs = res.json()
        except ValueError:
            return self.reply(502, {"error": "EA's answer wasn't JSON"})
        keep = ("clubId", "clubName", "platform", "wins", "losses", "ties", "gamesPlayed", "currentDivision", "bestDivision", "skillRating")
        self.reply(200, {"clubs": [{k: c.get(k) for k in keep} for c in (clubs if isinstance(clubs, list) else [])][:25]})
