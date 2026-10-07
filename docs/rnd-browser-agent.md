# R&D Browser Agent

The R&D browser agent is an external browser-capable executor for the existing R&D job queue.

## Contract

1. The Draft My Hair R&D UI creates jobs.
2. POST /api/rnd/agent/claim atomically leases one QUEUED job.
3. The agent opens Gemini in a persistent, already-authenticated browser profile.
4. The agent performs normal visible UI actions only: attach the exact source image, enter the exact current prompt, generate, and capture the result.
5. The agent uploads the generated image to POST /api/rnd/agent/artifact.
6. The agent reports completion to POST /api/rnd/worker/report.
7. Existing automated QA decides HUMAN_APPROVAL, REFINE, or EXHAUSTED.

## Runtime requirements

The browser-agent runtime needs:

- Node.js 20+
- Playwright installed in the agent runtime
- A headed Chromium/Chrome environment
- A persistent browser profile already signed in to the authorized Gemini account
- RND_APP_URL
- RND_WORKER_TOKEN
- RND_WORKER_ID
- RND_BLOB_READ_WRITE_TOKEN
- GEMINI_PROFILE_DIR

The browser agent is deliberately not a Vercel function. Vercel remains the control plane and state store; the browser-capable agent is the executor.

## Gemini compliance guardrails

The agent must not:

- bypass CAPTCHA, bot protection, authentication, quotas, or rate limits;
- create accounts to evade limits;
- reverse-engineer private Gemini APIs;
- scrape Gemini outside the normal UI workflow;
- falsify identity or service origin;
- use generated output to train another ML/AI system.

Google's current Terms prohibit abuse, bypassing protective measures, certain deceptive uses, and automated access that violates machine-readable instructions on Google's web pages. The agent therefore stays at normal UI interaction and must stop rather than attempt to defeat a protection.

## Current state

The control-plane endpoints and agent entry point are implemented. The Gemini UI adapter is intentionally NOT yet unattended-ready. It requires one supervised calibration against the current Gemini interface to lock the upload, prompt-entry, generate, and result-capture selectors and observable states.

Do not mark unattended generation enabled until that calibration is verified end-to-end.
