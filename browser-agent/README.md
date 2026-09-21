# Draft My Hair R&D Browserbase Agent

This is the Browserbase Functions executor for the R&D control plane.

## Architecture

Vercel R&D control plane -> Browserbase Function -> Gemini website -> R&D artifact -> automated QA.

The function is intentionally deployed separately from the Next.js application. The production application is not modified.

## Current safety state

The function has two modes:

- `calibrate`: opens the normal Gemini website and reports observable UI controls. It does not upload a source, submit a prompt, or generate an image.
- `generate`: claims/uses one R&D job, but currently stops before clicking Gemini's generate/send control until a supervised calibration has identified the correct visible control.

This is deliberate. We will not guess Gemini selectors and accidentally submit the wrong action.

## Browserbase setup

Browserbase Functions are current as of September 2026 and support TypeScript, Playwright over CDP, asynchronous invocations, and versioned deployments. Browserbase Contexts can persist cookies/local storage across sessions.

Install:

```bash
npm install
```

Required environment for the function:

```text
BROWSERBASE_API_KEY
BROWSERBASE_PROJECT_ID
RND_APP_URL
RND_WORKER_TOKEN
RND_WORKER_ID
```

The worker never receives the Vercel Blob storage token. It downloads the private source through the authenticated Draft My Hair control-plane endpoint.

## First deployment

Run from this directory:

```bash
bb functions publish index.ts --dry-run
bb functions publish index.ts
```

Then invoke calibration:

```bash
bb functions invoke <function-id> --params '{"mode":"calibrate"}'
```

Inspect the returned UI inventory and the Browserbase session replay/live view.

Do not invoke `generate` yet.

## Gemini authentication

Before generation, create one Browserbase Context for the authorized Gemini account and complete the normal Google/Gemini login in that context. Do not put Google credentials in source code or environment variables.

Browserbase documents Contexts as the mechanism for persisting cookies, storage, and authentication state between sessions.

## Compliance guardrails

- Normal visible Gemini UI only.
- No private Gemini API calls.
- No CAPTCHA/bot-protection bypass.
- No rate-limit/quota bypass.
- No account creation to evade limits.
- Stop when the site presents a protection or an unexpected authentication challenge.
- No training another AI model with generated output.

## Important

The current function is **not yet an unattended generator**. The first Browserbase invocation is a read-only UI calibration. The next code change should only happen after the live Gemini UI has been inspected and the exact upload/send/result states are confirmed.
