# Draft My Hair — Automation End-to-End Checkpoint

**Checkpoint date:** 2026-10-15  
**Purpose:** persistent evidence-based handoff. This is not a production-readiness declaration.

## Status legend
- **GREEN — verified working:** a specific behavior was demonstrated or targeted test passed.
- **RED — failed/not working:** a specific test or intended behavior demonstrably failed.
- **ORANGE — partial/blocked:** some evidence exists, but integration/runtime/isolation/concurrency is unverified.
- **GRAY — not verified:** insufficient evidence.

## Executive status
Historical records show the pipeline executed through enqueue, worker claim, image generation, artifact storage, report endpoint, and automated QA. The tested Italian Bob did **not** pass the quality gate. The historical generation run used Vertex, but the required architecture is **Gemini Web through a persistent Chrome browser worker**; that intended path is unverified. Production readiness is not established.

## Checkpoint register

| Subsystem | Status | Evidence / current state | Unverified or failure | Guardrail |
|---|---|---|---|---|
| GitHub repo | GREEN | `fahasfapyf-droid/draftmyhair` accessible via connector. | Checkpoint did not previously exist at root path. | Reconcile before future work. |
| Local R&D changes | ORANGE | Prior targeted tests, `tsc --noEmit --incremental false`, scoped `git diff --check` passed. | Changes are uncommitted; not necessarily deployed. | Preserve dirty state. Do not touch `tsconfig.tsbuildinfo` or `tools/rnd-worker/package-lock.json`. |
| Vercel Preview | GRAY | Recorded URL: https://draftmyhair-3x6x32xrl-draftmyhair.vercel.app/; deployment ID `dpl_5wdc6C18ZWAc62ZxRUSZgDZcgHBz`; SHA `bcdeba14b89f06b322f70a666f3c830e640f5f9d`. | Current live deployment and whether local changes are deployed were not re-verified in this checkpoint action. | No deployment performed. |
| Production isolation | ORANGE | Production Neon `Draft My Hair`; production Blob `draftmyhair` / `store_SXGdO1bqUMKzRIYv`. | Runtime isolation not proven by names alone. | Production untouched. |
| Preview database | GRAY | Candidate isolated Neon: `dmh-rnd-preview-isolated`, project `flat-block-22639366`, branch `main`, branch ID `br-summer-forest-b8qqkw44`. | Active Preview DATABASE_URL, schema, migration state, and host fingerprint unverified. Older records identify a different Neon project; resolve this discrepancy before DB action. | No worker/migrations/DB mutations until target verified. |
| Preview Blob | GRAY | Candidate store `dmh-prompt-lab` / `store_ZjSA3cZUbKwe6YuA`. | Runtime token target and upload/download path unverified. | No Blob writes performed. |
| Historical queue/worker | GREEN | Records show enqueue, claim, report endpoint, artifact storage, QA response. | Does not prove current runtime isolation/readiness. | Dedicated test job after environment checks. |
| Image generation provider | RED | Historical records explicitly say Vertex generation ran twice. | Required Gemini Web + persistent Chrome worker profile/auth/path unverified. | Vertex is QA-only; never use it as generation fallback. |
| Artifact storage | GREEN | Historical test stored generated artifacts. | Current Preview target, ownership, retention, retrieval not end-to-end verified. | No TTL/cleanup automation claimed. |
| QA hard gate | GREEN | Targeted QA hard-gate, image-integrity, Hindsight-refinement, report-lease-fence, worker-release-fence tests passed; TypeScript and scoped diff checks passed. | No accepted production-quality output proven. | Keep ≥9.5 for overall/identity/style/root/lighting; hairOnly PASS; artifacts NONE; canvas match. |
| Italian Bob quality | RED | Historical run failed because hair was too short; records show 9/10 then 7/10 (another audit records 6.5 and style accuracy 1). | No passing generation or accepted prompt/output capture proven. | Do not publish failed output. |
| Report artifact ownership | ORANGE | Local uncommitted report-route checks validate GENERATED artifact and job/attempt key prefix; targeted tests/typecheck passed. | No live integration or PostgreSQL concurrency test; schema/prefix assumptions need runtime validation. | Unit tests do not prove DB concurrency. |
| Lease fencing/retries | ORANGE | Local claim/report/release generation fencing and bounded report retries; targeted tests passed. | Real PostgreSQL races and failure-injection paths untested; timeout suitability needs review. | No worker until isolation + dedicated job are confirmed. |
| Hindsight | GREEN | Mocked recall → evaluator context → safe refinement prompt test passed. | Live bank/destination/credentials/retrieval/write path unverified. | Do not assume live memory is wired. |
| R&D enum migration | ORANGE | Older records identify `20261010090000_normalize_rnd_human_review_enums` as pending. | DB target discrepancy remains; application/verification not proven. | Resolve target and snapshot first; no migration without authorization. |
| Dashboard/review | GREEN | Older records say Run Builder and Approval Queue loaded; queue displayed HUMAN_APPROVAL. | Blind QA sample retrieval and all `/icon` 404s remain outstanding/unverified in older record. | Recheck Preview after environment/schema validation. |
| Human approval/publication | GRAY | Approval queue historically displayed HUMAN_APPROVAL records. | No verified passing image → approval → publication cycle. | Human approval required; never auto-publish. |
| Prompt library capture | GRAY | Capture/versioning is an identified requirement. | Passing result and accepted prompt capture not demonstrated. | Verify only after QA pass. |
| One-hour preview cleanup | GRAY | Requested previously for active previews. | No verified TTL/cleanup automation or launch override. | Do not claim it is running. |
| End-to-end acceptance | ORANGE | Some pipeline behavior and local regression checks demonstrated. | Gemini Web generation, verified Preview isolation, passing ≥9.5 output, approval, prompt capture, full Preview regression unproven. | Public launch and production promotion remain blocked. |

## Recorded identifiers (not proof of active runtime wiring)
- Repo: `fahasfapyf-droid/draftmyhair`
- Worktree: `C:\\Users\\IC\\dmh-qa-gate-clean`
- Branch: `rnd/qa-gate-clean-integration`
- Recorded HEAD: `bcdeba14b89f06b322f70a666f3c830e640f5f9d`
- Preview deployment: `dpl_5wdc6C18ZWAc62ZxRUSZgDZcgHBz`
- Candidate isolated Neon: `dmh-rnd-preview-isolated` / `flat-block-22639366` / `main` / `br-summer-forest-b8qqkw44`
- Candidate Preview Blob: `dmh-prompt-lab` / `store_ZjSA3cZUbKwe6YuA`
- Production Neon: `Draft My Hair`
- Production Blob: `draftmyhair` / `store_SXGdO1bqUMKzRIYv`

## Protected safety rules
1. Do not read, regenerate, restore, or modify `tsconfig.tsbuildinfo` or `tools/rnd-worker/package-lock.json`.
2. Preserve all existing dirty changes; no reset/revert/stash.
3. No production changes, deployment, live jobs, DB mutations, migrations, environment changes, installs, commits, or pushes without explicit authorization.
4. Generation must use Gemini Web through the persistent Chrome browser worker. Vertex is QA evaluation only; no generation fallback.
5. Do not run the worker until Preview DB, Blob, API URL, Hindsight destination, Gemini Web profile/auth, and host fingerprints are verified.
6. Do not reuse historical job `cmv6kq8dq0005l2067u1olmwh` / target `m2-real-e2e-italian-bob-001`; use a dedicated Preview test job.
7. Human approval is mandatory before publication.

## Safe session protocol
Read checkpoint → reconcile newest audits + repo/worktree → authorize narrow change → run targeted tests → separately verify runtime evidence → update GitHub and Library → read both back to verify.

## Next gates
1. Verify Preview runtime targets and resolve Neon discrepancy.
2. Verify Preview Blob/API/Hindsight/Gemini Web browser profile/auth without exposing secrets.
3. Add/execute failure-injection and concurrency coverage for local uncommitted changes without touching protected files.
4. Run one dedicated Preview test only after isolation is proven.
5. Obtain a genuine ≥9.5 result with every hard gate passing.
6. Verify human approval and prompt/output capture.
7. Complete Preview regression and independent readiness review.
