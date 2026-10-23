"""The club's full EA data as an ingest payload: /api/ea-fetch?club=<id>&platform=common-gen5

Used for the first load on /setup (app/api/setup calls it). Needs the site's CRON_SECRET as a
Bearer token, so only the site itself can make it call EA.
"""

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Vercel runs functions from the project root, so the shared module next to this file isn't on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _eafetch import build_payload  # noqa: E402

PLATFORMS = {"common-gen5", "nx"}


class handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        secret = os.environ.get("CRON_SECRET", "").strip()
        given = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
        if not secret or not hmac.compare_digest(given, secret):
            return self.reply(401, {"error": "Not allowed."})
        q = parse_qs(urlparse(self.path).query)
        club = (q.get("club") or [""])[0]
        platform = (q.get("platform") or ["common-gen5"])[0]
        if not club.isdigit() or platform not in PLATFORMS:
            return self.reply(400, {"error": "Need a numeric club id and a known platform."})
        payload, errors = build_payload(club, platform, "setup")
        if payload is None:
            return self.reply(502, {"error": f"EA refused: {'; '.join(errors)}"})
        self.reply(200, payload)
