# Draft My Hair — Gemini Web Agent

Local-only R&D automation for the Gemini web app in Chrome.

## Scope

This tool intentionally lives outside the Next.js/Vercel runtime. It uses a persistent local Chrome profile so the operator can sign in to Gemini normally and then automate:

1. open Gemini web
2. upload one reference image
3. submit one hairstyle prompt
4. wait for an image response
5. download the full-size generated image

Production generation, Vercel, Vertex, authentication, and the public website are not modified by this tool.

## Requirements

- Windows + Google Chrome
- A Google account already signed in to the persistent automation profile
- Gemini image generation available for that account
- Node.js/npm
- Playwright (`npm install` from the repository root)

## First run

From the repository root:

```cmd
npm install
npm run agent:gemini -- --image "C:\path\to\reference.jpg" --prompt "Create a modern Italian bob while preserving the person's identity exactly. Modify only the hair."
```

If the persistent profile has not been initialized, Chrome opens normally. Complete Google/Gemini sign-in manually, then rerun the command. The agent never receives or stores the Google password.

Generated files are saved under `tools/gemini-web-agent/output/`.

## Safety boundaries

- Never run this against `www.draftmyhair.com`.
- Never put Google credentials, cookies, session exports, or tokens in the repository.
- Keep the browser profile local and ignored by git.
- Treat generated images as R&D artifacts until they pass the DMH QA gate.
