# Draft My Hair — End-to-End Automation Checkpoint Register

**Checkpoint date:** 2026-10-15  
**Purpose:** evidence-based handoff; this is not a production-readiness declaration.  
**Overall status:** **NOT ACCEPTED FOR PRODUCTION**

## Mandatory architecture

- **Image generation:** Gemini Web through the persistent Chrome browser worker only.
- **Evaluation:** Vertex AI may be used for QA evaluation only.
- **Prohibited:** Vertex image generation and any Vertex generation fallback.
- Historical records report two Vertex image-generation uses. Those were architecture violations, not approved pipeline steps.
- DMH backend is the authoritative server-side hard-gate decision-maker.
- Hindsight provides relevant prior experimental learning to the prompt/refinement loop. It cannot override the prompt, hard gates, or human approval.
- A human must approve before publication.

## Status meanings

- **GREEN — demonstrated in the stated scope:** targeted test or historical behavior is evidenced; this does not automatically establish live end-to-end readiness.
- **RED — known failure/deviation:** a failure or architecture violation is recorded.
- **ORANGE — partial evidence:** local/mock/historical evidence exists, but live integration or runtime behavior is not verified.
- **GRAY — not verified:** no sufficient evidence.

## Executive summary

### What is actually working / demonstrated
- Targeted local QA hard-gate tests passed, including safe downgrading of inconsistent evaluator approvals.
- Image-integrity regression tests passed for nine pairs; six would have been rejected by the prior uncalibrated texture gate. Canvas mismatch remains blocking.
- Mocked Hindsight recall → evaluator context → safe refinement prompt test passed.
- Report lease-fence and worker-release-fence regression tests passed.
- TypeScript check passed with `--noEmit --incremental false`; scoped `git diff --check` passed.
- Historical records show enqueue/claim, artifact storage, report endpoint, and QA response have executed at some point.

### Known failures / deviations
- Vertex was historically used for image generation twice, violating the required architecture.
- The historical Italian Bob result failed the style/length quality gate. Recorded assessments vary across audits; no accepted result is evidenced.
- Canvas mismatch remains a blocking integrity condition.

### Not verified / not proven end-to-end
- Gemini Web generation through the persistent Chrome profile, including authentication and request/response flow.
- Gemini profile exhaustion → profile switch → successful regeneration; all-profiles-exhausted safe stop.
- Live Hindsight bank, destination, credentials, retrieval and write path.
- Active Preview database, Blob store, API URL, and Hindsight destination isolation from production.
- Deployed Vertex evaluation, independent final-verifier, and backend hard-gate routing on a real artifact.
- A genuine image passing all criteria at ≥9.5.
- Full human approval → accepted prompt/output capture → publication cycle.
- One-hour Preview artifact cleanup/TTL.
- Full Preview regression and production readiness.

## Intended end-to-end decision loop

1. Enqueue a job and claim it through the DMH worker.
2. Recall relevant prior outcomes from Hindsight. Use them to inform the prompt and likely defect-specific refinements; never let memory override the user’s requested hairstyle or hard gates.
3. Gemini Profile Manager selects an eligible authenticated persistent Chrome profile.
4. Generate through **Gemini Web only**.
5. Classify generation failures:
   - **Confirmed exhausted/unusable profile or session:** mark unavailable according to policy, select the next eligible profile, and retry within bounds.
   - **Transient/network error:** use bounded retry policy; do not misclassify it as exhaustion.
   - **Image-quality failure:** continue through QA, then use Hindsight-informed targeted prompt refinement. Do not rotate profiles solely because the image is poor.
   - **No eligible profiles remain:** defer/fail safely. **Never fall back to Vertex generation.**
6. Store the generated artifact and report it through the fenced worker/report path.
7. Vertex AI evaluates quality and integrity criteria; it does not generate.
8. An independent final verifier evaluates the artifact.
9. DMH backend validates every required result and makes the authoritative PASS/REJECT decision. Missing, inconsistent, malformed, or failed hard criteria must not approve.
10. On REJECT, if retry budget remains, use Hindsight-informed, defect-specific prompt refinement and return to Gemini Profile Manager/generation. On exhaustion, stop/reject safely.
11. On PASS, place the result in the human approval queue. Do not auto-publish.
12. After explicit human approval, capture the accepted prompt/output/version and publish according to the approval policy.

**Important:** the loop above is the required design. It is not proof that all stages currently work together in the live runtime.

## Checkpoint register

| Stage / checkpoint | Status | Evidence / what is known | What is unverified or failing | Required guardrail / next check |
|---|---|---|---|---|
| Gemini Web generation | ORANGE | Required architecture is recorded; historical generation activity exists. | Actual persistent Chrome path, auth, request/response, and artifact path are not proven. | Verify the actual live path before running a job. Gemini Web only. |
| Gemini profile switching | GRAY | The desired selection/rotation policy is defined. | No confirmed exhausted-profile → next-profile → successful regeneration test. | Failure-inject profile exhaustion and verify selected profile/reason/retry log. |
| All profiles exhausted | GRAY | Safe defer/fail is the required policy. | Runtime behavior not proven. | Bounded stop/defer; no Vertex generation fallback. |
| Vertex QA evaluation | ORANGE | Local QA-related tests passed. | Deployed evaluation routing on a real artifact not verified. | Prove Vertex is evaluation-only. |
| Hindsight recall/refinement | ORANGE | Mocked recall → evaluator context → safe refinement test passed. | Live memory store, credentials, destination, read/write path unverified. | Verify live read/write in isolated Preview; never grants gate authority. |
| DMH backend hard gate | GREEN locally / ORANGE live | Targeted tests cover inconsistent QA and final-verifier decisions being downgraded safely. | Deployed route and persisted decision on a real Preview job unverified. | Backend alone determines PASS/REJECT; missing/inconsistent criteria reject. |
| Independent final verifier | ORANGE | Local contract/regression evidence exists. | Independent live evaluation of a real artifact not demonstrated. | Verify it independently and backend rejects any inconsistent result. |
| Queue enqueue/claim | GREEN historically / ORANGE live | Historical records show enqueue and claim. | Current runtime and isolation not established. | Dedicated Preview job only after environment fingerprint checks. |
| Artifact storage/report | GREEN historically / ORANGE live | Historical artifact and report path executed. | Current Preview Blob target, retrieval, retention and report persistence unverified. | Verify target and artifact ownership/key before any test. |
| Artifact ownership validation | GREEN local tests / ORANGE live | Route checks GENERATED artifact and `rnd/attempts/${jobId}/${attemptNumber}-` prefix; tests/typecheck passed. | Runtime schema/key convention and live DB behavior unverified. | Confirm schema and run isolated test later. |
| Lease fencing/release | GREEN targeted local tests / ORANGE concurrency | Report lease fence and worker release fence regression tests passed. | Real PostgreSQL races and failure-injection paths untested. | Test concurrency only after isolation is proven. |
| Bounded report retries | GREEN local implementation context / ORANGE live | Recorded 270-second report timeout, retries after 5s and 15s, stop on 401/409, STOP after delivery failure. | Live timeout/error paths not verified. | Test timeout, auth/conflict and transient server failures in isolated Preview. |
| Image integrity | GREEN targeted tests / ORANGE live | Nine pair regressions passed; canvas mismatch remains blocking. | Real Gemini artifact has not demonstrated all gates passing. | Identity/canvas checks remain hard requirements. |
| Quality threshold | ORANGE | Gate tests exist; target criteria are recorded. | No genuine accepted ≥9.5 output. | Require ≥9.5 overall plus identity/style/root/lighting checks, hairOnly PASS, artifacts NONE, canvas match. |
| Italian Bob result | RED | Historical output was too short / failed style match; scores differ between audits. | No accepted output/prompt capture. | Do not publish. Re-test only after architecture and isolation gates pass. |
| Preview database | GRAY | Candidate Neon: `dmh-rnd-preview-isolated`, project `flat-block-22639366`, branch `main`, branch ID `br-summer-forest-b8qqkw44`. Production Neon is named `Draft My Hair`. | Active DATABASE_URL/host/schema discrepancy not resolved; names alone do not prove isolation. | Verify host/database/branch fingerprints before worker or migration. |
| Preview Blob | GRAY | Candidate `dmh-prompt-lab`, store `store_ZjSA3cZUbKwe6YuA`; production store `draftmyhair`, ID `store_SXGdO1bqUMKzRIYv`. | Runtime token and target unverified. | No writes until isolated target confirmed. |
| Preview API/env | GRAY | Recorded identifiers exist. | Current API URL and environment mapping not rechecked. | Verify targets without exposing secrets. |
| Vercel Preview | GRAY | Recorded URL `https://draftmyhair-3x6x32xrl-draftmyhair.vercel.app/`; deployment `dpl_5wdc6C18ZWAc62ZxRUSZgDZcgHBz`; SHA `bcdeba14b89f06b322f70a666f3c830e640f5f9d`. | Current deployment/SHA not rechecked. | Recheck live deployment before treating this as current. |
| Local R&D changes | ORANGE | Targeted tests, TypeScript `--incremental false`, and scoped diff check passed. | Changes are uncommitted and not proven deployed. | Preserve dirty changes; do not reset/revert/stash. |
| Dashboard / review queue | ORANGE | Historical notes say Run Builder and Approval Queue loaded and showed HUMAN_APPROVAL. | Blind QA retrieval and `/icon` 404s were unresolved/unverified in older notes. | Recheck Preview after environment/schema verification. |
| Human approval | ORANGE | Approval state was observed historically. | Full PASS → human decision → publication cycle not verified. | Explicit human approval mandatory; no auto-publish. |
| Prompt library capture | GRAY | Versioned capture is a requirement. | Accepted prompt/output capture not demonstrated. | Capture only after gate PASS and approval policy. |
| One-hour Preview cleanup | GRAY | Requested previously for active testing. | No verified TTL/cleanup automation or launch override. | Do not claim it is active. Verify separately. |
| Full end-to-end automation | RED/ORANGE | Some historical flow and local regression checks exist. | Gemini profile rotation, live Hindsight, isolated Preview, accepted image, approval, capture, and full regression are not proven in one run. | Not production-ready. Close every blocker with timestamped evidence. |

## Recorded identifiers (context only; not proof of active wiring)

- Repository: `fahasfapyf-droid/draftmyhair`
- Worktree: `C:\Users\IC\dmh-qa-gate-clean`
- Branch: `rnd/qa-gate-clean-integration`
- Recorded HEAD: `bcdeba14b89f06b322f70a666f3c830e640f5f9d`
- Recorded Preview deployment: `dpl_5wdc6C18ZWAc62ZxRUSZgDZcgHBz`
- Candidate Preview Neon: `dmh-rnd-preview-isolated` / `flat-block-22639366` / `main` / `br-summer-forest-b8qqkw44`
- Candidate Preview Blob: `dmh-prompt-lab` / `store_ZjSA3cZUbKwe6YuA`
- Production Neon: `Draft My Hair`
- Production Blob: `draftmyhair` / `store_SXGdO1bqUMKzRIYv`

These identifiers are recorded context only. They do not prove active runtime environment variables point to those targets.

## Protected safety rules

1. Do not read, hash, regenerate, restore, or modify `tsconfig.tsbuildinfo` or `tools/rnd-worker/package-lock.json`.
2. Preserve all dirty changes; no reset/revert/stash.
3. No production changes, deployment, live jobs, DB mutation, migration, environment change, install, or commit/push without explicit authorization.
4. Gemini Web via persistent Chrome is the only image-generation path. Vertex is QA evaluation only. No Vertex image generation or fallback under any condition.
5. Do not run the worker until Preview DB, Blob, API URL, Hindsight destination, Gemini profile/auth and host fingerprints are verified.
6. Do not reuse historical job `cmv6kq8dq0005l2067u1olmwh` / target `m2-real-e2e-italian-bob-001`; use a dedicated Preview test job.
7. Human approval is mandatory before publication.

## Next verification order

1. Verify Preview DB/Blob/API/Hindsight targets and resolve the Neon target discrepancy.
2. Verify Gemini Web persistent Chrome profile/auth and prove profile exhaustion rotation; prove no Vertex generation route/fallback.
3. Run targeted failure-injection and concurrency tests without touching protected files.
4. Run one dedicated Preview test only after isolation is proven.
5. Produce a genuine ≥9.5 result with every hard criterion passing.
6. Verify human approval and accepted prompt/output capture.
7. Complete Preview regression and independent readiness review.
