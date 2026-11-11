# Issue 70: native Gemini original-image capture

## Scope and base

Base: `fix/rnd-gemini-responsive-image-capture` at
`3b547daee922ea5ba5c96df8aad8ca33cd18e543`, compared with the active Task 3
worker checkout at `d5e45ed238fcfc2f5649a2e46f009fa30e236add`. The base adds
responsive currentSrc handling. This repair is isolated on
`fix/rnd-native-fullsize-download`. Issue 69 and Attempt 4/5 recovery commits
remain separate; they are not silently merged into this capture patch.

In the base, readImageBytes fetches a Gemini-origin blob URL (gemini-page.ts,
lines 483–495). A revoked URL makes that read fail even though the browser still
displays the image. The offline regression explicitly revokes the preview URL,
checks that fetching it fails, then captures via the independent native download.

## Capture flow

1. Revalidate the original user/assistant handles, conversation path, single
   generated image, currentSrc and intrinsic preview dimensions.
2. Hover that image and require exactly one explicitly named full-size/original
   download control inside its generated-image widget and verified assistant.
   Generic Download buttons, response-level unrelated controls and duplicates
   fail closed. No alternative image acquisition method is attempted.
3. Monitor trusted clicks, arm the Playwright download listener, then click that
   exact control once. Require one download from this page and a Gemini-origin
   blob or HTTPS Gemini/googleusercontent URL. No URL is fetched by this code.
4. Use download.saveAs into a unique persistent directory under the configured
   worker output directory. The provider filename is never used as a path.
5. Read the saved file; verify actual PNG/JPEG/WebP signatures, required header
   length, nonzero size and the unchanged 15 MiB ceiling. Decode for intrinsic
   dimensions only; the original bytes are never re-encoded or reconstructed.
6. Require at least the preview's intrinsic width/height and the existing 512px
   minimum on both axes. A native original may be larger than the responsive
   preview, with at most one preview pixel of aspect-ratio rounding. Smaller
   downloads and mismatched geometry are rejected. QA thresholds are unchanged.
7. Revalidate DOM/image identity, click provenance and download uniqueness; hash
   the original bytes with SHA-256 and rename to the detected format. Return the
   persistent path/checksum and verified metadata only after completion.

This follows Playwright's documented download-event-before-click and saveAs
contract: [Downloads](https://playwright.dev/docs/downloads),
[Download API](https://playwright.dev/docs/api/class-download). Context-managed
temporary files are deleted on context close; the independent saveAs copy survives.

The default capture deadline is 60 seconds across control lookup, download,
persistence and validation. Cancellation, timeout, browser close/crash, competing
clicks/downloads, wrong turn/page/origin, missing/duplicate controls, invalid bytes,
size and dimensions have distinct machine-readable error codes and stages.
Unfinished operations cannot return an artifact after the deadline. Failed or
partial local files are retained for inspection; they are never automatically
uploaded. Errors omit raw provider messages, URLs, filenames and credentials.

## Existing lifecycle and server integration

worker.ts already enables acceptDownloads (line 406) and awaits capture before
uploadArtifact/report (lines 298–323). It does not close the context during that
operation. A post-submission capture failure returns RECONCILE, stops claiming
and retains the browser until operator acknowledgement. One-shot remains limited
to one claim. None of this lifecycle code was changed.

The worker's prior-checksum rejection, canonical artifact endpoint's pre-upload
and transactional duplicate checks, Protocol 2 submission/claim-generation lease
fences, five-attempt limit, 9.5 QA gates and HUMAN_APPROVAL remain unchanged.
No live source image, job, attempt, queue, Blob object or deployed configuration was
read or mutated by this repair. No worker or live Gemini session was launched.

## Hindsight audit

Existing adapter: lib/rnd/hindsight.ts (configuration lines 17–23, recall line 89,
retention line 137). HINDSIGHT_API_URL enables it; HINDSIGHT_API_KEY is optional;
HINDSIGHT_RND_BANK defaults to draftmyhair-rnd. Calls have a 2.5-second timeout and
fail soft. The worker does not own this configuration: it belongs to the server.

The unchanged report route recalls at line 283 before primary/final evaluation,
stores advisory evidence in qaJson, and retains failed/completed outcomes at
lines 228/629. Both evaluator instructions mark history as untrusted advice.
Only passesRndCombinedHardGate determines the gate flags and approval transition;
Hindsight cannot directly set them. The mocked Hindsight integration and hard-gate
tests remain required checks. No second memory system or bypass was introduced.

docs/rnd/hindsight.md describes recall as occurring after QA; that chronology
differs from this branch's executable implementation. This task preserves the
implementation and reports that documentation discrepancy separately.

Presence-only inspection found the three Hindsight variables absent in this local
tool process. That is NOT evidence that deployed Hindsight is disabled. No server
environment, secret snapshot, Hindsight probe, recall or retention request was
accessed. Effective deployed configuration remains UNVERIFIED and would require
separately authorized deployment-specific names/status metadata and a safe probe.

## Recovery audit — recommendation only

Read-only comparison used fix/rnd-attempt4-reconciliation at 4a9b0a7d.
The existing /api/rnd/admin/reconcile route is itself pinned to attempt 3.
reconcile-attempt4 and reconcile-attempt5 duplicate its admin authentication,
exact job/target/source and recovered checksum pins, expired PROCESSING lease,
reserved-v2/prompt fence, prior-checksum checks, private Blob upload, transactional
recheck, attempt attachment and canonical report/QA handoff. The two additional
routes also admit submitted-but-uncaptured attempts. Their forms/pages are direct
consumers; they cannot simply be redirected to the attempt-3-pinned route.

Smallest future consolidation: extract the shared guarded implementation and use
one server-owned allowlist/manifest of authorized exact recovery tuples through
the existing route/form. Preserve digest pins, state checks, authentication,
report handoff, uncertain-commit retention and cleanup-on-definite-rejection.
Do not trust arbitrary caller-provided recovery identities or expected checksums.
Keep the old pages until their consumers and retained recovery evidence are reviewed.

Before generalizing, address two audit limitations: read/recheck followed by
unconditional writes is not proof of concurrency safety with canonical claims;
use a shared lock/conditional ownership transition and isolated database race tests.
Also preserve an already recorded submittedAt instead of overwriting it with the
operator timestamp; existing routes disclose that reconciliation timestamps are
not original Gemini times. These are recommendations, not changes in this patch.

All three routes require PROCESSING and attemptCount = requested attempt - 1.
They do not authorize reopening a terminal five-attempt job. No recovery route or
page was changed, removed, merged or invoked here.

## Validation and limitations

The offline browser suite covers real Playwright native downloads plus 26 native
capture scenarios: revoked preview, larger original, PNG/JPEG/WebP, persistence
after context close, wrong turn/widget/page/origin, competing click/download,
duplicate controls, missing event, stalled transfer, cancellation, save failure,
provider failure, MIME/size/header/decode/dimension failures and browser shutdown.
It also checks concurrent capture rejection and error-data redaction. Fixtures
are synthetic and fully offline; fixture canvas creation is NOT a production
artifact fallback. Worker lifecycle, route, protocol, lease, QA, image-integrity
and mocked Hindsight tests must pass as well.

Application checks use a disposable tracked-file snapshot, a separately generated
Prisma client, synthetic child-only configuration and blocked network transport.
Both a Next compile-only build and a full offline Next build passed, including
TypeScript and all 106 static pages. This credential-free snapshot is not a
deployable production artifact or evidence of provider/runtime compatibility.
The build warns about workspace-root discovery from multiple lockfiles; no
repository configuration was changed to suppress it. Production source,
installed clients, credentials and provider configuration are not altered.

Native control labels/widget placement on the current live Gemini UI remain
UNVERIFIED. The allowed selectors fail closed when the UI differs. Playwright's
download event does not itself carry an assistant-turn ID; provenance is enforced
through the frozen DOM handles, exact widget/control, exclusive trusted click,
single event, page/origin and byte/dimension checks. This is not cryptographic
provider attestation. A separately authorized supervised check of an existing
generated image is needed before claiming live capture reliability.

The base also retains its existing API-base fallback; execution must explicitly
target the verified isolated Preview. No deployment or worker startup is authorized
by this patch. The exhausted incident and all five attempts remain untouched.
