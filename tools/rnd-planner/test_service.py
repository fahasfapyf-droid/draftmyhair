import hashlib
import http.client
import json
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import service

TOKEN = "test-planner-only-" + "x" * 40


def request_data():
    objective, target = "Italian Bob geometry", "italian-bob"
    return {"schemaVersion": service.VERSION, "objectiveId": hashlib.sha256((target + "\n" + objective).encode()).hexdigest(), "objective": objective, "targetKey": target}


def plan(request):
    return {"schemaVersion": service.VERSION, "objectiveId": request["objectiveId"], "geometry": ["Compact chin-length perimeter"], "distinctions": [], "hypotheses": [], "evidence": []}


class ContractTests(unittest.TestCase):
    def invoke(self, backend=plan, body=None, token=TOKEN, timeout=0.1):
        server = service.make_server(TOKEN, backend, timeout=timeout)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=2)
            raw = json.dumps(request_data() if body is None else body)
            connection.request("POST", "/v1/plan", raw, {"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            response = connection.getresponse()
            result = response.status, json.loads(response.read())
            connection.close()
            return result
        finally:
            server.shutdown()
            server.server_close()

    def test_authenticated_valid_contract(self):
        status, result = self.invoke()
        self.assertEqual(status, 200)
        self.assertEqual(result, plan(request_data()))
        self.assertEqual(self.invoke(lambda request: {**plan(request), "geometry": ["Preserve soft curl definition at the nape."]})[0], 200)

    def test_authentication_precedes_backend(self):
        def forbidden(_request):
            self.fail("Unauthorized request reached backend")
        self.assertEqual(self.invoke(forbidden, token="wrong")[0], 401)

    def test_default_backend_never_fakes_harness(self):
        status, body = self.invoke(None)
        self.assertEqual(status, 503)
        self.assertIs(body["harnessIntegrated"], False)

    def test_unknown_request_privileges_rejected(self):
        for key in ["tools", "commands", "DATABASE_URL", "workerToken", "image"]:
            value = request_data()
            value[key] = "forbidden"
            self.assertEqual(self.invoke(body=value)[0], 400)

    def test_replay_wrong_objective(self):
        value = request_data()
        value["objectiveId"] = "0" * 64
        self.assertEqual(self.invoke(body=value)[0], 400)
        self.assertEqual(self.invoke(lambda request: {**plan(request), "objectiveId": "0" * 64})[0], 502)

    def test_malformed_plan_rejected(self):
        for value in [None, [], {}, {**plan(request_data()), "commands": ["shell"]}, {**plan(request_data()), "geometry": []}]:
            self.assertEqual(self.invoke(lambda _request: value)[0], 502)

    def test_oversized_request(self):
        self.assertEqual(self.invoke(body={"objective": "x" * 9000})[0], 413)

    def test_oversized_response(self):
        self.assertEqual(self.invoke(lambda request: {**plan(request), "geometry": ["x" * 100_000]})[0], 502)

    def test_privileged_and_secret_content_rejected(self):
        for text in ["curl https://example.invalid", "DELETE FROM RnDJob", "token=private-value", "vercel_blob_rw_fixture_only", "bypass identity gate", "upload Blob artifact", "https://username@research.invalid", "rm -rf /workspace", "$(invoke-command)"]:
            self.assertEqual(self.invoke(lambda request: {**plan(request), "geometry": [text]})[0], 502)

    def test_timeout_does_not_return_late_plan(self):
        def slow(request):
            time.sleep(0.3)
            return plan(request)
        self.assertEqual(self.invoke(slow, timeout=0.02)[0], 504)

    def test_error_redaction(self):
        def broken(_request):
            raise ValueError("PRIVATE_PROVIDER_SECRET")
        status, body = self.invoke(broken)
        self.assertEqual(status, 503)
        self.assertNotIn("PRIVATE", json.dumps(body))

    def test_dedicated_secret_required(self):
        with self.assertRaises(ValueError):
            service.make_server("short")

    def test_privileged_environment_rejected_before_listening(self):
        for name in ["DATABASE_URL", "RND_WORKER_TOKEN", "RND_PRODUCER_TOKEN", "RND_BLOB_READ_WRITE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "HINDSIGHT_API_KEY", "AUTH_SECRET", "CUSTOM_PROVIDER_API_KEY", "AWS_SECRET_ACCESS_KEY"]:
            with patch.dict(service.os.environ, {name: "fixture-only"}, clear=True):
                with self.assertRaisesRegex(SystemExit, "Privileged DMH configuration forbidden"):
                    service.main()


if __name__ == "__main__":
    unittest.main()
