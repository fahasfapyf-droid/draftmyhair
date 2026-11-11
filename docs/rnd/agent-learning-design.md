# Issue 71 — design and dependency/security assessment (before implementation)

Baseline: remote rnd/agent-learning-deerflow-v1 is exactly
5fe5ae3b9235341f36c62e8fb41d1a1c0f2054ce. It predates Protocol 2 and the native
capture implementation. Commit 3d832d22 is a follow-up to 86bcc0e8, not a standalone
replacement for this older worker. Port the minimal reviewed R&D-only protocol,
lease, duplicate and capture prerequisites, then cherry-pick both native-capture
commits with provenance. Preserve the original master/style prompts, 9.5 thresholds
and this baseline's mandatory canvas AND face-texture checks. No production route,
deployment, stored job, profile or credentials may be imported or changed.

## Proposed flow

Authenticated optional planner -> strict versioned plan -> bounded untrusted
Hindsight evidence -> style-only prompt synthesis -> immutable master/compiler ->
existing DMH controller -> Protocol 2 Windows worker/native original capture ->
independent current-image QA/final verification -> mandatory human approval.

Recall objective/target/style context before initial synthesis, before any campaign
exists. On failed QA, recall the actual defect and choose at most one safe targeted
correction, validated by the existing compiler. Memory must not enter primary/final
scoring. Store bounded evidence IDs and plan diagnostics with the job/attempt, not
secrets. Missing/malformed/unavailable memory or planner data falls back to existing
deterministic synthesis/refinement, never approval. Retain both failure and success.

Persist a per-job generation ceiling defaulting to five (configuration may lower
it), a separate bounded infrastructure counter, and the refinement count. Claim,
reclaim, report and exhausted transitions must compare-and-set inside transactions.
Infrastructure recovery must reuse the same submitted artifact/attempt, never
reset generation budget or redispatch an uncertain submission. Exhaustion sets
both job and target FAILED with stable codes. Migration SQL is review-only here;
no existing database or incident is accessed. Mock races are not PostgreSQL proof.

## DeerFlow dependency/security assessment

Official upstream Harness requires Python >=3.12 and currently identifies itself
as 2.3.0-dev. Its dependency surface includes sandbox execution, Kubernetes,
LangGraph/LangChain, MCP, crawling and multiple providers; the full App adds a
gateway and messaging services. These are excessive privileges for a hairstyle
research planner. Upstream is MIT licensed; redistribution must retain notices,
and transitive packages require their own pinned inventory/security review.

Sources: [Harness manifest](https://raw.githubusercontent.com/bytedance/deer-flow/main/backend/packages/harness/pyproject.toml),
[license](https://raw.githubusercontent.com/bytedance/deer-flow/main/LICENSE),
[security policy](https://raw.githubusercontent.com/bytedance/deer-flow/main/SECURITY.md).

No usable Python, uv or Docker was found on PATH or the inspected standard local
Python locations. A portable official Python >=3.12 runtime may be used outside
the repository for standard-library contract tests only, without global install
or PATH changes. Harness dependencies and model-provider calls will not be installed
or enabled speculatively. Unless an isolated tool-free Harness can actually be
run and authenticated, deliver the issue's permitted adapter/mock-boundary fallback.
Explicit status: **DeerFlow Harness NOT INTEGRATED** until separately demonstrated.

The separate Python service accepts only objective/context and returns a bounded
versioned JSON plan: geometry, confusable styles, hypotheses and evidence IDs.
No commands, tool calls, DB/Blob actions or queue controls are accepted. Node must
reject unknown fields, excessive bytes/depth/counts, wrong versions, redirects,
bad authentication and timeouts. The service gets a dedicated planner secret only;
no DMH database, Blob, worker, production or Hindsight credentials, customer photos,
filesystem tools, browser, shell, MCP, extensions, scheduling or approval access.
Default production backend must fail closed when no reviewed Harness is configured;
test backends must be injectable solely by local test code, never via requests.

Run only offline mocks, local authenticated HTTP contract tests, static checks,
Python tests, TypeScript/lint and an external credential-free build snapshot.
Do not deploy, run Gemini/Vertex/Hindsight providers, migrate, mutate jobs, merge
or enable unattended execution. Open a review PR only if required tests pass.

## Inherited boundary and release limitations

The canonical R&D approval handler is ADMIN-only and imports DRAFT/TESTING only.
The pre-existing Production `/api/internal/prompt-promote` route is deliberately
outside this issue's allowed changes: it trusts a shared secret and caller source
claims without independently verifying human approval. This patch neither calls
it nor grants its secret to memory/planner. Do not infer global production
promotion security from these R&D tests. Hardening that existing Production
endpoint requires a separately scoped change before claiming that guarantee.

Migration execution, actual PostgreSQL races, live research providers and real
Gemini execution are not validated here. A review PR is not runtime authorization.
Before pushing this branch, establish that Git push/PR creation cannot trigger a
Vercel auto-deployment; the user has prohibited deployment for this task.
