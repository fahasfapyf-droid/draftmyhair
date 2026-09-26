# Draft My Hair R&D Windows Worker

This is the server-backed Gemini Web execution worker for `rnd/prompt-lab-v3`.

## Locked responsibilities

The worker is deliberately limited to execution:

1. authenticate to the R&D worker API with `RND_WORKER_TOKEN`;
2. atomically claim one server-side R&D job;
3. download and checksum the immutable original source;
4. open the persistent Chrome/Gemini session;
5. submit the server-provided `currentPrompt` unchanged;
6. capture the generated image;
7. upload the generated artifact;
8. report the attempt for server-side QA.

It does **not** perform QA, mutate prompts, create queue files, or touch production generation/credit APIs.

## First-time setup on the Windows worker PC

From the repository root:

```cmd
cd tools\rnd-worker
npm install
npx playwright install chromium
```

The worker uses the existing signed-in Gemini Chrome profile by default:

```text
tools\gemini-web-agent\chrome-profile
```

Override it with `DMH_GEMINI_PROFILE_DIR` if the profile lives elsewhere.

Set these environment variables in the worker process:

```text
RND_API_BASE_URL=https://draftmyhair-git-rnd-prompt-lab-v3-draftmyhair.vercel.app
RND_WORKER_TOKEN=<Preview R&D worker token>
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Optional:

```text
DMH_GEMINI_PROFILE_DIR=C:\path\to\persistent\chrome-profile
DMH_RND_OUTPUT_DIR=C:\path\to\rnd-worker-output
RND_WORKER_ID_FILE=C:\path\to\.rnd-worker-id
```

Do not commit `.env`, the worker ID file, generated images, or the Chrome profile.

## Run

```cmd
npm start
```

On startup the worker performs the `/api/rnd/worker/hello` handshake, then polls `/claim` every 10 seconds.

A claimed job receives a 120-second server lease. The worker renews the lease every 40 seconds while Gemini is running.

Every generation attempt is reported to `/report`. The server remains authoritative for attempt count and the two-attempt autonomous ceiling.

## Deployment Protection note

The Preview deployment currently has Vercel Authentication in front of it. The worker's application Bearer token is separate from Vercel Deployment Protection. For a long-running local worker, do not use a temporary shareable URL as the permanent transport credential. Configure an appropriate Vercel automation/trusted-source/exception mechanism before unattended operation; the worker code keeps the application-level Bearer token mandatory regardless.
