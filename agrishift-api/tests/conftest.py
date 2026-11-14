import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

# Configure before the app is imported
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["BREVO_API_KEY"] = "test-api-key"
os.environ["BREVO_API_URL"] = "http://127.0.0.1:9999/v3/smtp/email"
os.environ["EMAIL_FROM_ADDRESS"] = "no-reply@agrishift-qa.com"

SENT: list[dict] = []


class FakeBrevo(BaseHTTPRequestHandler):
    """Stands in for api.brevo.com. Records each request and enforces the api-key header."""

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.headers.get("api-key") != "test-api-key":
            self.send_response(401); self.end_headers(); self.wfile.write(b'{"message":"unauthorized"}')
            return
        if body["to"][0]["email"].startswith("fail"):
            self.send_response(500); self.end_headers(); self.wfile.write(b'{"message":"boom"}')
            return
        SENT.append(body)
        self.send_response(201)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"messageId":"<test@brevo>"}')

    def log_message(self, *args):
        pass


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    # TestClient without a "with" block skips the app's startup hook, so create tables here
    from app import models  # noqa: F401
    from app.db import Base, engine
    Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def fake_brevo():
    server = HTTPServer(("127.0.0.1", 9999), FakeBrevo)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield
    server.shutdown()


@pytest.fixture()
def sent():
    SENT.clear()
    return SENT


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_users():
    yield
    from sqlalchemy import text
    from app.db import engine
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM users WHERE email LIKE '%@agrishift-qa.com'"))
