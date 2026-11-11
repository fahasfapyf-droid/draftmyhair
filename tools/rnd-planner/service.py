"""Isolated research contract. No Harness, model, tools, DB, Blob or worker access.

Production startup has no backend and returns 503. A reviewed tool-free Harness
backend is a separate qualification step; tests inject a local callable only.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import socket
import sys
import threading
from concurrent.futures import Future, TimeoutError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "dmh.rnd.research.v1"
SCHEMA = json.loads((Path(__file__).resolve().parents[2] / "contracts/rnd-research-plan.v1.json").read_text())
UNSAFE = re.compile(r"postgres(?:ql)?://|vercel_blob_rw_|-----BEGIN [A-Z ]*PRIVATE KEY|\bAIza[\w-]+|\bsk-[\w-]{16,}|https?://[^\s/]+:[^\s/]+@|\bBearer\s+\S+|\b(?:api[_ -]?key|password|secret|token)\s*[:=]|\b(?:curl|wget|powershell|cmd\.exe|bash|subprocess|eval|exec)\b|\b(?:DROP|ALTER|DELETE|INSERT|UPDATE)\s+(?:TABLE|FROM|INTO|\"?RnD)|\b(?:ignore|override|bypass|disable)\b.{0,60}\b(?:instruction|master|identity|gate|approval|qa|policy)|\b(?:queue|claim|upload|delete)\b.{0,30}\b(?:job|blob|artifact|worker)|/api/rnd/|```|</?(?:script|system)\b", re.I)


def matches(value, rule):
    kind = rule["type"]
    if kind == "string":
        return (isinstance(value, str) and len(value.strip()) >= rule.get("minLength", 0)
                and len(value) <= rule.get("maxLength", 1000)
                and ("enum" not in rule or value in rule["enum"])
                and ("pattern" not in rule or re.search(rule["pattern"], value)) and not UNSAFE.search(value))
    if kind == "array":
        return isinstance(value, list) and rule.get("minItems", 0) <= len(value) <= rule.get("maxItems", 0) and all(matches(v, rule["items"]) for v in value)
    if kind == "object":
        return isinstance(value, dict) and set(rule.get("required", [])).issubset(value) and all(k in rule["properties"] and matches(v, rule["properties"][k]) for k, v in value.items())
    return False


def valid_request(value):
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "objectiveId", "objective", "targetKey"}:
        return False
    if value["schemaVersion"] != VERSION or not isinstance(value["objective"], str) or not isinstance(value["targetKey"], str):
        return False
    if not 1 <= len(value["objective"].strip()) <= 4000 or not 1 <= len(value["targetKey"].strip()) <= 128:
        return False
    digest = hashlib.sha256((value["targetKey"] + "\n" + value["objective"]).encode()).hexdigest()
    return value["objectiveId"] == digest and not UNSAFE.search(value["objective"] + "\n" + value["targetKey"])


def make_server(token, backend=None, port=0, timeout=3.0):
    if not isinstance(token, str) or len(token) < 32:
        raise ValueError("Dedicated planner token required")
    slots = threading.BoundedSemaphore(2)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(2.0)

        def log_message(self, *_args):
            pass  # No headers, objectives, tokens, provider errors or request logs.

        def respond(self, status, value):
            raw = json.dumps(value, separators=(",", ":")).encode()
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_POST(self):
            supplied = self.headers.get("Authorization", "")
            if not hmac.compare_digest(supplied.encode(), ("Bearer " + token).encode()):
                return self.respond(401, {"code": "UNAUTHORIZED"})
            if self.path != "/v1/plan":
                return self.respond(404, {"code": "NOT_FOUND"})
            if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.respond(400, {"code": "INVALID_TRANSPORT"})
            length = self.headers.get("Content-Length", "")
            if not length.isdecimal() or not 1 <= int(length) <= 8192:
                return self.respond(413, {"code": "REQUEST_TOO_LARGE"})
            self.connection.settimeout(2.0)
            try:
                raw = self.rfile.read(int(length))
                if len(raw) != int(length):
                    raise ValueError()
                request = json.loads(raw)
            except (ValueError, UnicodeDecodeError, socket.timeout, RecursionError):
                return self.respond(400, {"code": "INVALID_JSON"})
            if not valid_request(request):
                return self.respond(400, {"code": "INVALID_REQUEST"})
            if backend is None:
                return self.respond(503, {"code": "HARNESS_NOT_CONFIGURED", "harnessIntegrated": False})
            if not slots.acquire(blocking=False):
                return self.respond(503, {"code": "PLANNER_BUSY"})
            future = Future()

            def run():
                try:
                    future.set_result(backend(request))
                except Exception:
                    future.set_exception(ValueError("PLANNER_BACKEND_FAILED"))
                finally:
                    slots.release()

            threading.Thread(target=run, daemon=True).start()
            try:
                plan = future.result(timeout=timeout)
                if not matches(plan, SCHEMA) or plan["objectiveId"] != request["objectiveId"] or len(json.dumps(plan).encode()) > 16384:
                    return self.respond(502, {"code": "INVALID_PLAN"})
                return self.respond(200, plan)
            except TimeoutError:
                return self.respond(504, {"code": "PLANNER_TIMEOUT"})
            except Exception:
                return self.respond(503, {"code": "PLANNER_UNAVAILABLE"})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    if sys.version_info < (3, 12):
        raise SystemExit("Python >=3.12 required")
    if any(value and (name in {"DATABASE_URL", "DIRECT_URL", "RND_WORKER_TOKEN", "RND_PRODUCER_TOKEN", "PROMPT_PROMOTION_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET", "GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_API_KEY", "GEMINI_API_KEY", "VERCEL_TOKEN"} or "BLOB" in name or name.startswith("HINDSIGHT_")) for name, value in os.environ.items()):
        raise SystemExit("Privileged DMH configuration forbidden in planner runtime")
    server = make_server(os.environ.get("RND_PLANNER_TOKEN", ""), port=int(os.environ.get("RND_PLANNER_PORT", "8765")))
    server.serve_forever()


if __name__ == "__main__":
    main()
