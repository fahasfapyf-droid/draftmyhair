# Draft My Hair R&D Windows Worker

This is the server-backed Gemini Web execution worker for the local R&D pipeline. The worker runs on the Windows PC, launches visible Chrome with the persistent Gemini profile, executes the generation in Gemini Web, and reports the artifact back to the server for automated QA.

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

The worker uses a local Gemini profile registry. The registry maps each logical worker profile to a separate Chrome `--user-data-dir`; that directory is the actual authenticated Gemini session. The registry is array-based and has no hard-coded two-profile limit: the supplied `profiles.example.json` starts with six profile entries, and you can add more entries as needed using the same fields (`id`, `label`, `directory`, `status`, `hourlyLimit`, and `minIntervalMs`). Keep each `id` unique and each Chrome `directory` separate. Run `setup-gemini-profiles.cmd` on the Windows worker PC to create the isolated directories and authenticate each configured Google/Gemini account interactively. The worker never stores Google passwords or session tokens in the repository. On first startup, `start-rnd-worker.cmd` creates `profiles.json` from `profiles.example.json`; review and extend that local file before unattended operation. Each profile points to its own persistent Chrome user-data directory and is selected only when its configured status is ACTIVE and its local usage window permits another generation.

Profile state is stored locally in `profile-state.json` and is not committed. The worker uses a default limit of 30 generations/hour and a 2-minute minimum interval per profile. These can be overridden per profile or with `RND_PROFILE_HOURLY_LIMIT`, `RND_PROFILE_MIN_INTERVAL_MS`, and `RND_PROFILE_COOLDOWN_MS`.

A quota/rate-limit error marks the current profile EXHAUSTED for the cooldown period and the worker may rotate to another eligible ACTIVE profile. An account restriction/policy/access error marks the profile RESTRICTED and stops the worker; it does not automatically bypass the restriction.

Set these environment variables in the worker process:

```text
RND_API_BASE_URL=https://draftmyhair-git-rnd-local-gemini-worker-v1-draftmyhair.vercel.app
RND_WORKER_TOKEN=<Preview R&D worker token>
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Optional:

```text
DMH_GEMINI_PROFILE_DIR=C:\path\to\persistent\chrome-profile
DMH_RND_OUTPUT_DIR=C:\path\to\rnd-worker-output
RND_WORKER_ID_FILE=C:\path\to\.rnd-worker-id
```

Do not commit `.env`, the worker ID file, `profiles.json`, `profile-state.json`, generated images, or any Chrome profile.

## Run

```cmd
start-rnd-worker.cmd

or directly:

npm start
```

On startup the worker performs the `/api/rnd/worker/hello` handshake, then polls `/claim` every 10 seconds.

A claimed job receives a 120-second server lease. The worker renews the lease every 40 seconds while Gemini is running.

Every generation attempt is reported to `/report`. The server remains authoritative for attempt count and the two-attempt autonomous ceiling.

## Deployment Protection note

The Preview deployment currently has Vercel Authentication in front of it. The worker's application Bearer token is separate from Vercel Deployment Protection. For a long-running local worker, do not use a temporary shareable URL as the permanent transport credential. Configure an appropriate Vercel automation/trusted-source/exception mechanism before unattended operation; the worker code keeps the application-level Bearer token mandatory regardless.
