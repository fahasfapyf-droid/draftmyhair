# Issue 71 — offline verification and review limits

Historical snapshot at f463f347. Superseded by `agent-learning-final-review.md`,
which includes the newly authorized disposable PostgreSQL tests and remediation.

Branch: `rnd/agent-learning-deerflow-v1`. Audited baseline:
`5fe5ae3b9235341f36c62e8fb41d1a1c0f2054ce`.

The remote branch was exactly that baseline. Because it predates the capture
implementation and Protocol 2, the integration first ports the R&D-only reviewed
protocol/submission/lease/duplicate/approval prerequisites (`09f9b7a7`), then
cherry-picks native capture `86bcc0e8` as `0202ac79` and requested follow-up
`3d832d22446e5188419f3a2fb653e4fb2198e860` as `b0ba808f`, with `-x` provenance.
The Gemini capture implementation and its mock test are byte-equivalent to
`3d832d22`. The baseline remains an ancestor. Master/style library files,
`lib/rnd/qa.ts`, Production routes and root dependency manifests are unchanged.

## Commands and results

Run from the repository root. All following checks exited **0**. Full command
arguments and unabridged stdout/stderr are included in the external review package.

| Command | Evidence |
| --- | --- |
| `node --import tsx scripts/test-rnd-learning.mock.ts` | 99 assertions; bounded memory, initial/refinement wiring, outage fallback, strict plans, real local authenticated Node/Python fake-backend boundary, redirect rejection |
| `node --import tsx scripts/test-rnd-budgets.mock.ts` | Real claim/report/release handlers with mocked I/O: generation and infrastructure ceilings, terminal job/target, uncertainty, one refinement, artifact reuse, stale fences, quota reset rejection |
| `node --import tsx scripts/test-rnd-task3-routes.mock.ts` | ADMIN approval/CAS/rollback; claim checksum history; artifact duplicate/final fence; retired legacy writes; no DB/Blob access |
| `node --import tsx scripts/test-rnd-protocol2.mock.ts` | Protocol, clean reservation/submission phases, legacy rejection, artifact gating and worker order |
| `node --import tsx scripts/test-rnd-report-lease-fence.ts` | Pure fence behavior plus explicitly static route assertions; not DB races |
| `node --import tsx scripts/test-rnd-worker-heartbeat-fence.ts` | Mocked real heartbeat handlers; same-worker stale generation and expired lease rejection; legacy 401/410 |
| `node --import tsx scripts/test-rnd-worker-release-fence.ts` | In-memory predicate model plus static SQL/worker assertions |
| `node --import tsx scripts/test-rnd-qa-hard-gate.ts` | 41 behavioral assertions: actual QA functions with fake model, 9.49 veto/9.5 boundary, final veto, both integrity gates; two source wiring assertions separately labeled |
| `node --import tsx scripts/test-rnd-image-integrity.ts` | Nine local Sharp pairs, six mandatory face-texture vetoes preserved |
| `node --import tsx --test tools/rnd-worker/gemini-page.mock.test.ts tools/rnd-worker/worker-lifecycle.mock.test.ts` | 2 test files passed; 28 native download scenarios; offline browser fixtures and mocked one-shot/uncertainty lifecycle |
| `<approved-python> -I -B tools/rnd-planner/test_service.py` | 13 standard-library tests: authenticated HTTP, malformed/size/secret/tool/timeout/replay rejection, default unconfigured backend, privileged environment rejection |
| `node node_modules/typescript/bin/tsc --noEmit -p tools/rnd-worker/tsconfig.json` | Worker TypeScript |
| `node node_modules/eslint/bin/eslint.js <feature-production-files>` | Standard rules, no overrides, for all Issue 71 feature production files |
| `node node_modules/eslint/bin/eslint.js --rule '@typescript-eslint/no-explicit-any: off' --rule '@typescript-eslint/no-require-imports: off' <all-changed-TypeScript>` | Scoped inherited worker/mock conventions only; lint config unchanged; not a claim that repository-wide lint is clean |
| `git diff --check` | No whitespace errors; Windows LF/CRLF notices are informational |

The Node/Python test requires `DMH_TEST_PYTHON` to point to an approved runtime.
Tests used an official, signature-verified portable Python 3.12.10 outside the
repository, without PATH/global install changes. Use a supported patched Python
version for any later deployment. No third-party Python dependencies installed.

An external disposable snapshot includes tracked and relevant new source files,
uses the installed Node dependencies, generates Prisma into **that snapshot**,
and aliases its generated client there. It uses an allowlisted environment with
synthetic localhost:1 DB configuration and rejects Node network requests. Commands:

```text
node <prisma-cli> generate --schema <snapshot>/prisma/schema.prisma
node <typescript-cli> --noEmit --incremental false -p <snapshot>/tsconfig.json
node <next-cli> build <snapshot> --webpack
```

All exited 0, including full Next.js build/static generation (101 pages). Snapshot
only: `experimental.cpus=2`, private generated Prisma output, TypeScript alias and
incremental=false. No application configuration was changed for the build.
The build emitted an existing multiple-lockfile workspace-root warning.

Earlier validation found stale source assertions and test-only TypeScript
compatibility issues (ProcessEnv NODE_ENV, script module detection); these were
corrected and the affected checks rerun. No QA threshold or detector was changed.

## Release limits

- **DeerFlow Harness NOT integrated.** The default Python service returns 503
  HARNESS_NOT_CONFIGURED. Actual HTTP tests use a deliberately fake local backend.
- New migrations are review artifacts only; no migration or DB query was run.
  Test the complete chain, constraints and concurrent SQL against a new verified
  disposable PostgreSQL database before release. Mocks are not race-safety proof.
- One targeted visual refinement is stricter than the five-attempt absolute cap.
  Infrastructure retries share a separate durable per-job budget of three;
  fourth failure is terminal. No uncertain submission is regenerated automatically.
- The pre-existing Production shared-secret promotion endpoint is unchanged and
  does not independently verify human provenance. The new planner has no access
  to it or its secret; canonical R&D approval remains ADMIN-only DRAFT/TESTING.
- Explicitly configure and verify the worker's intended isolated API target
  before any separately authorized execution; inherited worker defaults are not
  a deployment-binding guarantee.
- User requested local commits/review package only. No push, PR, deployment,
  generation, real provider request, existing job change, DB/Blob access or merge.
