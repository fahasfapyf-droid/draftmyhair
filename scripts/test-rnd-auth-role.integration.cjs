/* Real NextAuth signed-session role-demotion regression; disposable local DB and synthetic user only. */
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.join(__dirname, "..", "package.json"));
const { PrismaClient } = req("@prisma/client");
const argon2 = req("argon2");
const repo = path.resolve(__dirname, "..");
(async () => {
  const meta = JSON.parse(require("node:fs").readFileSync(process.env.DMH71_DB_MANIFEST || "C:/Users/IC/.codex/review-packages/issue71-final-review-eccc81bd-20261112/security-fix-database.json", "utf8"));
  assert.equal(meta.host, "127.0.0.1");
  const db = `postgresql://${meta.user}@127.0.0.1:${meta.port}/${meta.database}?schema=public`;
  const port = 3119, base = `http://127.0.0.1:${port}`;
  const secret = "issue71-role-demotion-" + require("node:crypto").randomBytes(24).toString("hex");
  const env = { ...process.env, DATABASE_URL: db, AUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "development", CI: "1" };
  const prisma = new PrismaClient({ datasources: { db: { url: db } } });
  let server;
  try {
    const password = "Synthetic-Role-Test-2026!";
    const user = await prisma.user.create({ data: { name: "Issue71 Synthetic Role Demotion", email: "issue71-role-" + Date.now() + "@example.invalid", passwordHash: await argon2.hash(password), emailVerified: new Date(), role: "ADMIN", isActive: true, isDeleted: false } });
    server = spawn(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
    let ready = false;
    for (let i = 0; i < 90; i++) { if (server.exitCode !== null) throw new Error("Next dev server exited"); try { const response = await fetch(base + "/api/auth/csrf"); if (response.ok) { ready = true; break; } } catch {} await delay(1000); }
    assert.ok(ready, "NextAuth dev server ready");
    const csrfRes = await fetch(base + "/api/auth/csrf"), csrf = (await csrfRes.json()).csrfToken, csrfCookies = csrfRes.headers.getSetCookie();
    const cookie = values => values.map(x => x.split(";")[0]).join("; ");
    const callback = await fetch(base + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie(csrfCookies) }, body: new URLSearchParams({ csrfToken: csrf, email: user.email, password, callbackUrl: base + "/dashboard", json: "true" }) });
    const cookies = [...csrfCookies, ...callback.headers.getSetCookie()];
    const sessionCookie = cookies.find(x => /authjs\.session-token=/.test(x) || /__Secure-authjs\.session-token=/.test(x));
    assert.ok(sessionCookie, "real signed NextAuth session cookie issued");
    const signedCookie = cookie(cookies);
    const get = pathname => fetch(base + pathname, { headers: { cookie: signedCookie } });
    const before = await get("/api/rnd/qa-calibration/review");
    assert.equal(before.status, 200, "active ADMIN can access calibration review");
    const initial = await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } }); // deliberately do not bump sessionVersion
    const stale = await get("/api/rnd/qa-calibration/review");
    assert.equal(stale.status, 401, "old signed ADMIN session rejected after role demotion");
    const completion = await fetch(base + "/api/rnd/qa-calibration/complete", { method: "POST", headers: { cookie: signedCookie, "content-type": "application/json" }, body: JSON.stringify({ promptVersionId: "synthetic-missing-candidate" }) });
    assert.equal(completion.status, 401, "stale session cannot complete calibration");
    const image = await get("/api/rnd/qa-calibration/review/image?attemptId=synthetic-missing-attempt");
    assert.equal(image.status, 401, "stale session cannot retrieve calibration image");
    const promotion = await fetch(base + "/api/internal/prompt-promote", { method: "POST", headers: { cookie: signedCookie, "content-type": "application/json" }, body: JSON.stringify({ promptKey: "synthetic", sourceAttemptId: "synthetic" }) });
    assert.equal(promotion.status, 401, "stale session cannot promote prompt");
    const promptHeaders = { cookie: signedCookie, "content-type": "application/json" };
    const promptCreate = await fetch(base + "/api/dashboard/admin/content/prompts", { method: "POST", headers: promptHeaders, body: JSON.stringify({ hairstyleId: "synthetic-style", prompt: "synthetic" }) });
    assert.equal(promptCreate.status, 401, "stale session cannot create prompt version");
    const promptPatch = await fetch(base + "/api/dashboard/admin/content/prompts/synthetic-version", { method: "PATCH", headers: promptHeaders, body: JSON.stringify({ status: "ACTIVE" }) });
    assert.equal(promptPatch.status, 401, "stale session cannot activate prompt version");
    const promptDelete = await fetch(base + "/api/dashboard/admin/content/prompts/synthetic-version", { method: "DELETE", headers: promptHeaders });
    assert.equal(promptDelete.status, 401, "stale session cannot delete prompt version");
    const final = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, sessionVersion: true } });
    assert.equal(final.role, "USER"); assert.equal(final.sessionVersion, initial.sessionVersion, "role mismatch alone revoked the session");
    console.log("PASS real NextAuth signed-session integration: ADMIN access works before demotion; same signed cookie denied review, image retrieval, calibration completion and promotion after DB role changes without sessionVersion increment.");
    await prisma.user.delete({ where: { id: user.id } });
  } finally {
    if (server && server.exitCode === null) server.kill();
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
