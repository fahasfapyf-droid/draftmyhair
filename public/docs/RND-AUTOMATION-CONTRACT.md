# Draft My Hair — R&D Automation Contract
**Status:** Canonical operating specification  
**Purpose:** This document is the shared source of truth for every agent, engineer, and automation working on Draft My Hair R&D. Read it before diagnosing, modifying, extending, or operating the R&D workflow. If implementation differs from this contract, report the discrepancy; do not silently assume the intended behavior is already implemented.

## 1. Mission and non-negotiable constraints

The R&D system improves hairstyle prompts and generation quality through controlled experiments. Its quality target is **at least 9.5/10**, while preserving the subject's identity and ensuring a hair-only transformation.

- The face is a locked region. Do not intentionally alter facial identity, facial geometry, expression, skin texture, tone, or lighting.
- Only hair and the minimum anatomy area necessarily revealed by hair removal may change.
- Preserve head geometry, ears, framing, perspective, background, and original photographic character.
- Never weaken QA thresholds to make a candidate pass.
- Hindsight is advisory memory, not an authority. It cannot override the authoritative prompt, deterministic integrity checks, QA gates, attempt limits, or human approval.
- No automatic customer/publication release from a model score alone. Human approval remains required.
- Do not run paid image generation or external artifact retrieval in synthetic tests unless explicitly approved.
- Never expose credentials, tokens, private source images, or private artifact URLs in logs or reports.

## 2. Canonical workflow

```text
R&D job / experiment enqueued
    ↓
Worker authenticates and claims job under a lease
    ↓
Load source image + authoritative hairstyle prompt/version
    ↓
Recall relevant prior evidence from Hindsight (advisory context)
    ↓
Gemini browser worker generates the preview
    ↓
Store generated artifact and report its reference
    ↓
Local image-integrity checks (Sharp)
    ↓
Hard Gate 1: primary QA + integrity conditions
    ↓ only if primary QA passes
Hard Gate 2: independent final verification
    ↓
Combine gate results; never average away a failed hard condition
    ├─ FAIL → classify defect → targeted refinement/retry within limits
    │          → generate again → integrity + QA gates again
    │          → exhausted → reject/mark exhausted and preserve evidence
    └─ PASS → eligible for human review
                   ↓
             Human approval required
                   ↓
             Approved prompt/version may be published
    ↓
Record experiment evidence and outcome for future Hindsight recall
```

Hindsight participates both before evaluation (recall) and after an outcome is available (retain useful evidence). It is not a substitute for the DMH controller or a gate.

## 3. Generation provider versus QA providers

### Image generation
The intended/currently specified image-generation path is **Gemini Pro 3.1 through Gemini Web using the persistent Chrome/browser worker**. The worker uses Playwright to open the generation UI, upload the source/reference image, submit the prompt, wait for output, capture the generated image, store the artifact, and report it. **Vertex AI is evaluation-only; never add Vertex image generation or a Vertex-generation fallback.** Verify the live browser/profile path before claiming it is currently operational.

### Image integrity
Local `sharp`-based checks inspect basic canvas/aspect ratio and face-region image statistics. These are heuristics, not mathematical proof that every face pixel is unchanged.

### Hard Gate 1 — primary QA
Default evaluator model: `gemini-2.5-flash` through Vertex AI, configurable via `RND_QA_MODEL`. It evaluates identity preservation, hairstyle/style accuracy, root integration, lighting consistency, hair-only compliance, and visible artifacts. Server-side logic computes/validates the score and requires the configured 9.5+ threshold plus required pass statuses and integrity conditions.

### Hard Gate 2 — independent final verification
Default evaluator model: `gemini-2.5-pro` through Vertex AI, configurable via `RND_FINAL_QA_MODEL`. It independently evaluates the source, generated image, and authoritative hairstyle prompt. It must independently satisfy the required score and pass conditions. It runs only after primary QA passes; failure or missing verification must not be treated as a pass.

### Credentials
The Vertex evaluator requires `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_LOCATION`, and `GOOGLE_SERVICE_ACCOUNT_JSON`. Never print these values. Presence in configuration is not proof that live calls work; validate safely without disclosing secrets.

## 4. Hindsight: role and safety boundary

Hindsight is the persistent R&D memory layer intended to make experiments cumulative rather than stateless. Relevant memory may include:
- prompt experiments and prompt/version identifiers;
- model behavior and repeatable failure modes;
- QA score patterns and defect classifications;
- successful, targeted refinements and whether they actually improved results;
- relevant R&D discoveries and engineering decisions.

Expected cycle:
1. **Recall:** Query for evidence relevant to the hairstyle, defect, evaluator pattern, or experiment. Keep retrieved context bounded and relevant.
2. **Advise:** Provide evidence as advisory context to the evaluator/refinement process. Preserve the authoritative style prompt and hard constraints.
3. **Evaluate:** Apply normal integrity checks and both hard gates. Hindsight cannot change thresholds or turn FAIL into PASS.
4. **Retain:** After the result is known, record a compact, evidence-backed summary: experiment/job/attempt identifiers, prompt version or hash, model/provider identifiers where safe, QA component scores, integrity outcome, defect category, refinement applied, and final outcome. Store private image bytes/URLs only where the approved memory design explicitly permits it; default to references/metadata rather than duplicating sensitive assets.
5. **Reuse cautiously:** A remembered success is a hypothesis to test, not a guarantee. Confirm that the source, hairstyle target, and defect are comparable.

Do not store secrets, authentication tokens, raw credentials, or unnecessary personal data in Hindsight. Keep memory retrieval failures observable; do not silently claim that Hindsight is connected if recall/retain did not succeed.

## 5. Retry, refinement, and terminal behavior

Current configured limits in the R&D code:
- Maximum generation attempts: **5**
- Maximum refinement count: **4**
- Maximum infrastructure retries: **3**

Treat these as separate counters. Infrastructure failures must not be mislabeled as image-quality failures. A failed quality gate should produce a concrete defect diagnosis and a targeted refinement, not a vague request to “make it better.” Respect lease expiry, authenticated worker protocol, idempotency/conditional state transitions, and terminal-state protection. When limits are exhausted, stop and preserve evidence rather than loop indefinitely.

## 6. Human approval and publication

Only a candidate passing the required integrity and both QA gates becomes eligible for human review. Passing the gates does not itself authorize publication. Human approval and the project's authorized publication path remain mandatory. Rejected candidates and failed experiments may be retained as diagnostic evidence but must not be presented as approved outputs.

## 7. Evidence status — do not overclaim

The following are distinct statuses and must be reported honestly:

- **Code-level Hindsight wiring:** Audits report that recall is called before QA and advisory evidence is passed to evaluator instructions; mocked integration tests support this behavior.
- **Live Hindsight bank connection:** Not fully independently verified. Prior audit results conflicted; a reported Preview probe was not independently confirmed by all reviewers.
- **Real report-path recall/retain:** Reliable retrieval, correct Preview bank resolution, query length, latency, and evidence retention during a supervised real attempt remain verification items.
- **Successful human approval and publication path:** Do not claim it is proven unless a current end-to-end run demonstrates it.
- **Full paid generation → artifact → both gates → Hindsight retain → human approval:** Do not claim this entire cycle is production-verified until it has been safely demonstrated end-to-end.

When reporting status, label each item `VERIFIED`, `FAILED`, `UNVERIFIED`, or `BLOCKED` and cite concrete evidence (test/run/deployment/commit). A successful build or mocked test is not proof of live provider integration.

## 8. Agent operating instructions

Every agent accessing this project must:
1. Read this contract and relevant R&D status/audit notes before proposing changes.
2. Inspect the actual current branch, worktree, deployment, and tests; this document is intent, not proof of current runtime state.
3. Preserve existing user changes and secrets. Do not print `.env` contents, credentials, tokens, private artifact URLs, or source images.
4. Do not touch production data, perform migrations, trigger paid generation, change deployment targets, or publish outputs without explicit authorization.
5. Do not commit, push, merge, or deploy unless explicitly authorized for that action.
6. Make minimal, targeted changes; run relevant tests and report exact results.
7. If implementation and this contract disagree, report the precise mismatch and evidence. Do not silently rewrite this contract to match a bug.
8. After an authorized change to workflow behavior, update this contract and all canonical copies in the same task, then verify that copies agree.

## 9. Canonical-copy policy

The canonical document path in the repository is:

`public/docs/RND-AUTOMATION-CONTRACT.md`

Keep the Library copy and any Vercel-served copy synchronized to this repository document. GitHub is the version-controlled canonical source; the Library is the durable agent reference; the `public/docs/` copy is served as a static document by a successful Vercel deployment. A file existing in a Vercel project configuration or an unrelated deployment is not proof that agents will automatically read it. Agents must be instructed to read this contract at task start.
