import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(process.cwd(), "tools/gemini-web-agent");
const PROFILE_DIR = path.join(ROOT, "chrome-profile");
const GEMINI_URL = "https://gemini.google.com/app";
const CHROME_PATH = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main(): Promise<void> {
  await fs.mkdir(PROFILE_DIR, { recursive: true });

  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${PROFILE_DIR}`,
    "--new-window",
    GEMINI_URL,
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });

  child.unref();

  console.log("Normal Chrome sign-in window opened for the local Gemini profile.");
  console.log("Complete Google sign-in in that Chrome window.");
  console.log("Do not use an automation/Playwright window for sign-in.");
  console.log("After Gemini loads normally, close that Chrome window and return here.");

  const rl = readline.createInterface({ input, output });
  await rl.question("Press Enter after you have closed the normal Chrome window... ");
  rl.close();

  console.log(`Gemini profile saved locally at: ${PROFILE_DIR}`);
  console.log("You can now run npm run agent:gemini with the same profile.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
