# Isolated R&D research contract — Harness NOT integrated

This is Issue 71's explicit adapter/mock-boundary fallback. No DeerFlow package,
weights, model calls or research backend is installed. The production entry point
returns authenticated `503 HARNESS_NOT_CONFIGURED`, `harnessIntegrated:false`.
`contract_fixture.py` is test-only and must never be deployed as a planner.

## Boundary

Node sends POST `/v1/plan` with a dedicated Bearer credential and exactly
`schemaVersion`, SHA-256 `objectiveId`, `objective`, `targetKey`. No photographs,
job/attempt access, DB/Blob/worker/Google/Hindsight credentials or tool access.
The shared [schema](../../contracts/rnd-research-plan.v1.json) permits only
bounded geometry, style distinctions, hypotheses and evidence references.
Unknown keys, privileged content, replayed objective IDs and invalid sizes fail.
Requests are at most 8 KiB, responses 16 KiB. Python bounds backend execution to
three seconds and two concurrent calls; Node bounds transport to five seconds,
requires JSON/200/exact response URL, and rejects all redirects. TLS verification
uses the platform defaults. Default bind is loopback only. No raw provider errors,
headers, credentials or objectives are logged.

## Offline checks

Use an approved Python >=3.12 runtime; no third-party packages are needed:

```powershell
python -I -B tools/rnd-planner/test_service.py
$env:DMH_TEST_PYTHON = '<absolute path to approved Python >=3.12>'
node --import tsx scripts/test-rnd-learning.mock.ts
node --import tsx scripts/test-rnd-budgets.mock.ts
```

Tests use an injected callable and actual local authenticated HTTP. They do not
test DeerFlow Harness, provider research, PostgreSQL races or deployment binding.

## Proposed isolated deployment runbook — separate approval required

1. Review this branch, prerequisite port, migrations and full diff. Qualify the
   SQL chain on a new verified disposable PostgreSQL database before release;
   do not apply migrations to an existing/shared/Production database here.
2. Run only one Protocol 2 writer generation against the chosen isolated DB.
   Revoke access for old worker deployments and legacy writers before testing.
   Claims/artifacts/heartbeats on retired agent routes return 410 after auth.
3. Provision a distinct non-root Python >=3.12 service with a supported patched
   runtime, read-only code filesystem, memory/CPU/process limits, no mounted DMH
   secrets or customer files, no shell/MCP/browser/sandbox/scheduler extensions.
   The portable 3.12.10 runtime used for offline tests is not a deployment pin.
4. Keep a secret allowlist containing only a new dedicated planner credential.
   Terminate verified HTTPS at an explicitly controlled internal reverse proxy;
   expose only POST `/v1/plan`, enforce request/header/concurrency/rate limits,
   disable redirects and body/header logging. Restrict callers and deny egress
   until an approved research backend and specific destinations are qualified.
5. Start `python -I -B tools/rnd-planner/service.py` inside that isolated runtime.
   Do not inherit the main application's environment. Configure Node's URL/token
   separately only after approval. Default service remains 503 without Harness;
   Node safely ignores unavailable/invalid plans. Do not use the fixture backend.
6. To enable actual DeerFlow, pin a reviewed Harness commit/dependency lock and
   retain MIT notices; inspect every transitive dependency. Provide a tool-free
   backend and demonstrate authenticated end-to-end requests, schema/timeout/
   secret rejection and real evidence provenance in this isolation first. No
   approval or queue authority may be delegated. This is future work.
7. Roll back planner use by removing Node-side optional planner configuration
   under separate change approval, or stopping the isolated service. Memory and
   planner outages never relax QA or cause a generation budget reset. Do not
   reverse migrations or reset jobs to roll back this optional planner.

## Authoritative safety state

PostgreSQL owns jobs/attempts/artifacts/approvals. Each job stores a generation
ceiling (default five, allowed 1–5), an infrastructure retry count and refinement
count. The global budget can only tighten a stored ceiling. One targeted visual
refinement is permitted; a second failed image is terminal even if fewer than
five attempts were used. Infrastructure failures permit three retries (fourth
failure terminal), with bounded exponential jittered backoff. Expired reclaim
also consumes that same durable job budget. Recovery of a completed artifact
reuses it; uncertain submission is terminal/reconciliation-only and never reset.
Unsubmitted release is generation-fenced, consumes retry budget and cannot
release a dispatched/artifact-bearing attempt. Counters and job/target transitions
commit together. These statements describe code and mocks, not verified DB races.

Memory is recalled before style synthesis and after failed independent QA. It can
help select or stop the exact QA correction, never invent one or approve. The
immutable master and original color rules remain in the compiler. Primary and
final QA receive only the current image pair and authoritative prompt. Every
score must be >=9.5, canvas AND face texture must pass, independent final QA must
pass, then an authorized human must approve. Promotion creates DRAFT/TESTING;
this R&D flow never activates production prompts. The separate pre-existing
Production `/api/internal/prompt-promote` shared-secret route remains outside
scope and does not independently establish human-review provenance. This is an
inherited release risk, not a security guarantee established by these tests.
No unattended execution is approved.
