"""Loopback test fixture only. Not a CLI production backend or real Harness."""
from pathlib import Path
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from service import make_server, VERSION


def fake_backend(request):
    return {"schemaVersion": VERSION, "objectiveId": request["objectiveId"], "geometry": ["Compact chin-length perimeter"], "distinctions": [{"style": "French Bob", "distinction": "Different perimeter and weight distribution"}], "hypotheses": [], "evidence": [{"referenceId": "fixture-only", "summary": "Synthetic contract evidence; no research was performed"}]}


if __name__ == "__main__":
    server = make_server(os.environ["RND_PLANNER_TOKEN"], fake_backend)
    print(server.server_port, flush=True)
    server.serve_forever()
