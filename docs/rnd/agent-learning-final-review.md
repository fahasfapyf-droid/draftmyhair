# Issue 71 final engineering review — 2026-11-12

Starting branch `rnd/agent-learning-deerflow-v1`, HEAD
`f463f347836d906d07c5d89806d6be63d5d84ba3`, clean, four local commits ahead.
Those commits and ancestry are preserved. Remediation is a new local commit;
the external review package records its exact final hash and complete diff.

**Verdict: READY FOR HUMAN REVIEW. Runtime/release authorization: NO-GO.**
This is local engineering evidence, not a deployment approval or proof that a
currently deployed worker/server/database has this code or these permissions.

## Confirmed defects and corrections

1. Concurrent approvals for different jobs of one hairstyle both selected the
   same next prompt version. Reproduced against starting HEAD on PostgreSQL:
   one transaction failed with Prisma P2002. All application prompt writers now
   lock the hairstyle row before version allocation or activation. A partial
   unique index additionally allows only one ACTIVE version per hairstyle.
2. Raw lease SQL compared Prisma UTC `timestamp(3)` values with session-local
   `timestamptz`. A live lease falsely failed in Asia/Karachi. Both the DB clock
   and bound claim-generation parameters now convert explicitly to UTC; report,
   submission, artifact and release fences use that representation. Real tests
   cover UTC, Asia/Karachi and America/New_York transaction zones.
3. Human approval trusted stored Boolean flags/overall alone and approved every
   pending attempt on the job. It now independently checks all typed primary and
   final dimensions >=9.5, hair-only/artifacts, BOTH integrity checks and exact
   generated artifact ownership/checksum. Only the selected attempt is approved.
   The same transaction stores reviewer/session identity, time, attempt/artifact
   IDs, artifact checksum and exact prompt SHA-256 in existing `qaJson`.
4. Shared-secret promotion trusted caller content/source claims and activated a
   new version directly. It now requires ADMIN session authentication, resolves
   the complete source chain server-side, verifies persisted human evidence and
   all hard gates, exact prompt and artifact, and activates only the already
   linked PASSED-calibration candidate. Replays are idempotent. Unknown/foreign
   source IDs fail closed; no shared secret is accepted as approval authority.
5. Admin content APIs could directly create ACTIVE unproven prompts or edit an
   approved source-linked prompt before activation. Such requests now return
   explicit 409 codes. Draft creation and calibration edits remain available;
   source-linked content is immutable. Activation requires verified source and
   prior completed calibration. Existing compiled production fallback is not
   changed. This intentionally rejects formerly permitted unproven activation.
6. Source-attempt deletion could erase a candidate's provenance by SET NULL.
   The source FK is now RESTRICT; a real Prisma delete is rejected with P2003.
7. QA rereads did not compare artifact/source bytes with stored size/SHA-256.
   Both now validate them and reject redirects. The exact, checksum-verified
   legacy source fixture fallback remains; unknown/corrupt fallback fails.
8. Old E2E GET seeded credentials/enqueued before hitting an incompatible P1
   handshake, and worker test-enqueue could create catalog/campaign/queue rows.
   Both are retired before body/provider/Prisma access. E2E requires ADMIN then
   returns 410; worker test-enqueue preserves worker auth then returns 410.
   Its CLI helper performs no requests. Windows worker uses canonical P2 only.
9. Missing worker API configuration silently selected an unrelated stale alias.
   An explicit HTTPS origin is now required before browser launch/claim; URL
   credentials/paths and known Production aliases are rejected. Local HTTP
   requires a separate explicit local flag. This is NOT provider identity proof.
10. Research input filtering now rejects username-only URL userinfo and common
    shell fragments. Dedicated planner tokens cannot reuse producer/promotion/
    memory credentials. Python rejects generic privileged credential env names.
    These are defense in depth; the capability boundary has no command executor,
    tools, queue writer, approval authority or customer-image API.
    Legitimate hairstyle "curl" geometry remains accepted; actual curl command
    URL/flag forms stay rejected instead of banning that entire hairstyle word.

## Migration audit

Historical migration files are unchanged. New forward migration:
`20261112090000_rnd_state_provenance_guards` (explicit BEGIN/COMMIT).

- Full ordered repository chain: **26 migrations applied by Prisma to a NEW
  PostgreSQL 17.11 database**. All recorded finished; none rolled back. All 26
  stored checksums match the exact repository SQL bytes used for that test.
- Pre-Issue71 schema upgrade tested separately with synthetic prior records.
  FAILED job status, attempt count, failure code and original prompt survive.
  Defaults do not reopen work. Observed refinement markers/revisions consume the
  refinement allowance; job infrastructure usage is at least the existing sum
  of attempt counters. Larger counters are preserved, never reset downward.
- NOT NULL/default and nonnegative guards reject invalid counters. Maximum
  generation budget remains 1–5. No generation/refinement allowance increased.
- Exact R&D enum labels, columns/defaults, FK definitions, unique/index metadata
  and partial ACTIVE index inspected in PostgreSQL and captured in the package.
- Invalid NULL/negative/out-of-range writes rejected (23502/23514); duplicate
  ACTIVE data makes the guard migration fail (23505), with backfills rolled back.
  No arbitrary winner, human approval or counter history is fabricated.
- Existing missing historical retry events cannot be reconstructed from absent
  data. Before rollout, review legacy in-flight jobs and freeze all old writers;
  do not treat inferred lower bounds as a complete historical retry ledger.

**Full schema diff remains exit 2:** three inherited, non-R&D index differences:
Feedback.createdAt, VerificationToken.expires, VerificationToken.identifier.
The same differences exist before remediation. No R&D/PromptVersion diff remains.
Custom checks/partial index are separately catalog-tested because Prisma schema
does not express them. This is not a claim of whole-repository schema equality.
No unrelated index correction is bundled into this issue.

Application/recovery procedure (not executed on an existing database): quiesce
writers, obtain approved backup and read-only checks for invalid counters,
duplicate ACTIVE versions and existing provenance links; resolve conflicts by
explicit human decision before migration. Apply forward migrations only to the
verified intended target under separate authorization. A failed guard transaction
must be investigated, not marked applied or bypassed. Do not reverse the nullable
submission prerequisite, erase counters or remove proof to roll back application
code. No reset/drop/resolve against existing environments is part of this task.

## Protocol compatibility matrix

| Stage/path | Current contract and verification |
| --- | --- |
| Producer enqueue | Producer/controller auth; planning first; durable per-job budget and diagnostics; no worker enqueue authority |
| Hello/claim | P2 hello before browser/claim; claim requires protocol 2; clean reserved-v2 submittedAt NULL; DB claim serialization and CAS |
| Submission begin | Records uncertainty/generation start; no successful submission time; response loss stops for reconciliation |
| Submission submitted | Records actual timestamp under live owner/generation/attempt fence; no blind repeat if response uncertain |
| Native capture | Issue70 capture helper unchanged; fresh chat/current turn/native original bytes, duplicate checks; 28 offline scenarios |
| Artifact | Scoped generation/lease, original checksum history, final DB fence/recheck; concurrent upload commits one asset; Blob operations fake in tests |
| Report | Original prompt/source/artifact; independent QA/final QA; strict integrity; transaction fence; duplicate/lost-response retry cannot commit twice |
| Heartbeat/release | Exact owner/generation; unexpired lease; release excludes submitted/uncertain/artifact-bearing attempts; separate retry budget |
| Recovery | Fresh unsubmitted reservation may resume within infra budget; completed artifact resumes QA only; uncertain/legacy reservation is reconciliation-only |
| Human approval/rejection | ADMIN-only; job CAS wins once; exact proof/selected attempt; DRAFT/TESTING import only; style version allocation serialized |
| Legacy agent writes | Auth preserved; claim/artifact/heartbeat 410 with canonical P2 replacement, no DB/Blob operation |
| Old E2E/test enqueue | 401/410 before writers; stale CLI disabled; neither can seed credentials or bypass budgets |
| Deployed worker/server | **UNVERIFIED**; no live endpoint or provider metadata call. Local P2 compatibility is not deployment binding proof |

## Real PostgreSQL concurrency evidence

Cluster: new temporary directory `dmh71-pg-review-8e5022d0b00040c2947c7df99fcfc446`,
listen 127.0.0.1:53883, PostgreSQL 17.11; database names randomly generated with
`dmh71_review_` prefix. Server address, current database and data directory are
asserted before writes. No existing R&D/Production DB is used. Official EDB HTTPS
binary archive provenance and local SHA-256 are recorded; postgres.exe is not
Authenticode-signed, so no independent publisher signature is claimed.

| Scenario | Real database result |
| --- | --- |
| Two claims, one queued job | One reservation and one winner |
| Two same-worker reclaims after expiry | One new generation; retry count increments once; visual count unchanged |
| Old heartbeat after reclaim | 409, no newer lease renewal |
| Uncertain submission then reclaim | Terminal/reconciliation-only, no new reservation/dispatch |
| Concurrent artifact commits | Same asset ID, no duplicate committed asset; storage faked |
| Two reports of same attempt | One 200 and one 409; one attempt/state transition |
| Successful report response discarded, then replay | 409; no new report/attempt/generation |
| Stale report fence racing a newer claim | Stale commit false, newer generation retained |
| Live fence under three session timezones | Accepted only current live generation; heartbeat remains UTC |
| Approve versus reject | One 200/one 409; job/target agree |
| Duplicate approval | One import/proof; other 409 |
| Same-style concurrent R&D/manual draft imports | Distinct sequential versions, no P2002 after fix |
| Delete source of linked prompt | P2003, provenance retained |
| Forged/unapproved/integrity-failed promotion | 401/409; no ACTIVE mutation |

Tests execute actual route handlers and actual Prisma/PostgreSQL transactions.
ADMIN session, image/QA/provider and Blob interfaces are faked; this does not
test real cookies, model accuracy, Blob atomicity, serverless failures or every
possible race. No exactly-once Gemini execution guarantee is made.

## Learning/planner safety and validation

Hindsight stays bounded/untrusted/advisory; immutable master compilation and
current-image scoring are independent of retrieval authority. It cannot approve,
change budgets or initiate generation. Outage fallback remains deterministic.
**DeerFlow Harness NOT integrated:** actual local authenticated HTTP tests use a
fake backend; default backend is HARNESS_NOT_CONFIGURED. No model installation
or backend/tool/OS sandbox qualification is claimed. Future service OS/network
isolation still requires separate review; application rejection is not a sandbox.

Final validation includes the original 18 checks plus provenance/source tests,
Prisma validation, full migration/upgrade tests and real DB concurrency. Learning:
105 checks; provenance/retired writers: 74; QA: 41 behavioral checks plus labeled
source assertions; nine image pairs/six mandatory vetoes; native capture 28 cases;
Python 13 tests. Exact commands, exit codes and unabridged output—including failed
diagnostics—are in `commands.jsonl` in the external review package. Strict lint
is used for remediation production code; inherited/mock lint keeps its two
explicit documented overrides. Full Next build is offline/network-blocked in a
disposable snapshot, not a deployment; no real credentials loaded or client
generation into shared node_modules. The pre-existing lockfile-root warning is
retained in the build log.

Failed diagnostics are not omitted: initial client generation could not resolve
@prisma/client in the external schema directory (corrected with a dependency
junction, no installation); first DB identity guard saw inet /32 text (changed
to host()); real non-UTC lease failures exposed the UTC defect; initial setup
wrapper inherited the background server pipe and was terminated after verified
server startup. The full schema diff exit 2 remains an explicit open item.

Not run: live Preview/Production APIs, actual database/provider bindings, existing
job recovery, real authentication cookies, image generation, real Blob operations,
actual DeerFlow research or external deployment tests. No push/PR/deploy/merge.

The disposable PostgreSQL server was shut down after the final tests. Its data
directory is retained outside the repository as evidence; no persistent service
was installed and no existing database or Windows service was stopped.

## Remaining release gates and next action

Human review of the exact local diff and evidence is next. No runtime authorized.
Before any controlled test: verify exact new deployment SHA/resource bindings,
review legacy states/constraints, and ensure no old deployment/worker can write
the same DB. Stopping the Windows worker is insufficient: separately authorize
revoking obsolete R&D writer-role privileges/sessions and credentials or use a
fresh dedicated role/isolated branch accessible only to the reviewed P2 server.
Do not rotate Production credentials. Enumerate scheduled/local/external writers,
then verify P2 hello and explicit worker target before separately authorizing one
new test job. None of those operational steps was executed here.

Cross-environment Production promotion remains blocked when approved source data
does not exist in the authoritative local resource chain. This branch does not
invent a remote DB connection or trust caller JSON. A future reviewed provenance
export/import or signed attestation contract is needed if isolated R&D approvals
must cross that boundary. Legacy approvals without saved review/hash evidence
require separately authorized review; no automatic proof backfill is performed.
