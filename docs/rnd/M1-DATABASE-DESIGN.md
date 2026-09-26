# R&D Prompt Lab — M1 Database Design

Status: design-only; no production schema or database migration is changed by this document.

## Safety boundary

- `main` remains the production source of truth.
- R&D records are intentionally separate from `Generation`, `Payment`, `Wallet`, `CreditTransaction`, and the production generation engine.
- The original source image for an R&D target is immutable by application contract.
- Every generation attempt gets its own durable attempt record and artifact reference.
- No R&D operation consumes customer credits.
- Human approval is required before an R&D result becomes a Prompt Library candidate.
- Approved candidates enter `PromptVersion` as `DRAFT`; they are never auto-activated.

## Models

### RnDCampaign

Purpose: groups one R&D run and its selected targets.

Fields:

- `id` — cuid primary key
- `name` — campaign name
- `status` — DRAFT | RUNNING | PAUSED | COMPLETED | CANCELLED
- `autoAdvanceEnabled` — optional controlled auto-advance flag
- `createdByUserId` — admin user id, application-enforced; deliberately no relation field in M1 to avoid modifying the production `User` model
- `createdAt`, `updatedAt`

Relations:

- `targets: RnDTarget[]`

### RnDTarget

Purpose: one hairstyle/color/beard test target within a campaign.

Fields:

- `id`
- `campaignId`
- `targetType` — SINGLE | COMPOSITE | PARALLEL
- `targetKey` — stable target identifier
- `hairstyleId` — optional reference identifier; no production relation in M1
- `hairColorKey` — optional
- `beardKey` — optional
- `hardCoreInstruction` — optional long text
- `sourceAssetId` — required immutable R&D asset reference
- `currentJobId` — optional
- `status` — DRAFT | QUEUED | PROCESSING | QA | HUMAN_APPROVAL | APPROVED | REJECTED | EXHAUSTED | FAILED
- `createdAt`, `updatedAt`

Relations:

- `campaign: RnDCampaign`
- `sourceAsset: RnDAsset`
- `jobs: RnDJob[]`

### RnDAsset

Purpose: isolate R&D source and generated media from customer `Image` records.

Fields:

- `id`
- `kind` — SOURCE | GENERATED
- `storageKey` — unique private storage key
- `blobUrl` — private artifact URL/reference
- `originalFilename` — optional
- `mimeType`
- `fileSize`
- `width`, `height` — optional
- `checksum` — optional integrity hash
- `immutable` — defaults true for SOURCE assets
- `createdAt`

Relations:

- `sourceForTargets: RnDTarget[]`
- `generatedForAttempts: RnDAttempt[]`

### RnDJob

Purpose: server-authoritative work item claimed by the Windows worker.

Fields:

- `id`
- `targetId`
- `status` — QUEUED | PROCESSING | QA | HUMAN_APPROVAL | COMPLETED | REFINING | EXHAUSTED | FAILED | CANCELLED
- `promptVersionNumber`
- `currentPrompt` — complete prompt snapshot
- `attemptCount` — defaults 0
- `leaseOwner` — nullable worker id
- `leaseExpiresAt` — nullable
- `heartbeatAt` — nullable
- `queuedAt`, `startedAt`, `completedAt`, `updatedAt`
- `failureCode`, `failureMessage` — optional

Relations:

- `target: RnDTarget`
- `attempts: RnDAttempt[]`

### RnDAttempt

Purpose: immutable audit record for one Gemini Web submission.

Fields:

- `id`
- `jobId`
- `attemptNumber` — 1 or 2 for autonomous attempts
- `prompt` — exact complete prompt submitted
- `promptRevision` — structured revision identifier
- `submittedAt`
- `generationStartedAt`, `generationCompletedAt` — optional
- `artifactId` — optional generated R&D asset
- `qaJson` — optional structured QA payload
- `overallScore` — optional decimal
- `aiGatePassed` — optional boolean
- `publicationTierPassed` — optional boolean
- `verdict` — REFINE | HUMAN_APPROVAL | APPROVED | EXHAUSTED | FAILED
- `refinementSlot` — optional identifier of the one corrected prompt slot
- `refinementReason` — optional text
- `errorCode`, `errorMessage` — optional

Relations:

- `job: RnDJob`
- `artifact: RnDAsset?`

## Locked workflow rules

1. Source asset never changes across attempts.
2. Attempt 2 references the same `RnDTarget.sourceAssetId`.
3. A refinement changes one addressed prompt slot only, then rebuilds the complete prompt.
4. Autonomous attempts are capped at 2.
5. `< 9.4` requires targeted refinement when an autonomous attempt remains.
6. `9.4–<9.5` and `>= 9.5` both require human approval.
7. `>= 9.5` is the publication-tier threshold, not an automatic activation rule.
8. Human approval creates an R&D Prompt Candidate and a `PromptVersion` in `DRAFT` status.
9. R&D never calls the customer credit/debit path.
10. The server is authoritative for Gemini submission spacing (minimum 5 minutes) and the rolling 12 submissions/hour limit.

## Migration safety gate

**Do not add this schema to the production Prisma schema or create/apply a migration until the database environment used by preview deployments is explicitly isolated from the production database.**

The current production build script runs `prisma migrate deploy`, so an R&D migration must not be introduced blindly into a branch that could execute against the production database.

M1 therefore ends with this design artifact. The next implementation gate is to verify the preview/staging database boundary, then add the actual Prisma models and migration only when that boundary is proven safe.
