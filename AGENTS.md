# Agent entrypoint — Draft My Hair

**Mandatory first read:** [R&D Automation Contract](public/docs/RND-AUTOMATION-CONTRACT.md).

Before working on this repository, every coding, QA, R&D, or operations agent MUST read that contract and the latest R&D checkpoint/audit records. It defines the intended generation path, Hindsight's advisory recall/retain role, hard QA gates, retry limits, human approval, safety boundaries, and which runtime claims remain unverified.

Non-negotiable reminders:
- Image generation: Gemini Pro 3.1 via Gemini Web and the persistent Chrome/browser worker only. Vertex AI is for QA evaluation only. No Vertex image generation or fallback.
- Hindsight is advisory memory. It cannot override the authoritative prompt, integrity checks, either hard gate, retry limits, or human approval.
- Never weaken the 9.5+ quality requirement or publish without human approval.
- Preserve user changes and secrets. Never expose credentials or private artifact URLs.
- Do not touch production data, run migrations, trigger paid generation, change environment settings, commit/push/merge, or deploy unless explicitly authorized for that action.
- Verify actual branch, worktree, provider configuration, and deployment state before claiming the system is operational. Mocked tests and a successful build do not prove end-to-end readiness.
- If code differs from the contract, report the exact discrepancy and evidence; do not silently assume either one is correct.

After an authorized workflow change, update the contract, keep its Library copy synchronized, and verify the relevant Vercel deployment serves the current version.
