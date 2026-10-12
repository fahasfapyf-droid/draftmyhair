# Hindsight R&D memory integration

The R&D control plane treats Hindsight as an optional learning layer. PostgreSQL remains the authoritative record for jobs, attempts, QA, prompts and approvals.

## Runtime configuration

Set these server-side environment variables:

- `HINDSIGHT_API_URL` — base URL of the Hindsight API.
- `HINDSIGHT_API_KEY` — optional bearer token when the Hindsight deployment requires authentication.
- `HINDSIGHT_RND_BANK` — optional memory bank ID; defaults to `draftmyhair-rnd`.

The Hindsight API exposes retain and recall operations through the memory endpoints. The DMH adapter uses asynchronous retain so generation/QA does not wait for memory extraction.

## Current integration boundary

After automated QA, DMH:

1. Recalls historical R&D outcomes for the same target/hairstyle and current defect.
2. Stores the recalled evidence in the attempt QA JSON for auditability.
3. Retains the completed/failed attempt as historical R&D evidence.

Historical memory is **advisory only** in this phase. It does not rewrite the authoritative prompt, bypass the transformation gate, change the 9.5 QA thresholds, or alter the one-refinement ceiling.

If Hindsight is unavailable, the R&D state machine continues normally.

## Intended next phase

Once the bank contains enough validated outcomes, the recalled evidence can feed a dedicated strategy selector. That selector must remain subordinate to the deterministic DMH prompt compiler, protected-region checks, QA gate and human approval path.
