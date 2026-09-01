/**
 * Headless smoke test template for viewer apps.
 *
 * Usage:
 *   bun add -d playwright-core            # in the viewer project (or run from scratchpad)
 *   bun run smoke.ts <baseUrl> [outDir]   # e.g. bun run smoke.ts http://localhost:5173 ./shots
 *
 * Adapt PAGES to the app's routes. Always include:
 *  - the landing page
 *  - one typical item page (each tab/view)
 *  - the WORST-CASE item (largest transcript / most entries)
 *  - an interaction (expand a tool call, run a search) via page.click/fill
 *
 * Uses an existing Chrome/Chromium install so no browser download is needed.
 * Fails (exit 1) on any console error or pageerror. Review the screenshots
 * yourself afterwards — visual review catches what console checks miss.
 */
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:5173";
const outDir = process.argv[3] ?? "./smoke-shots";

// Adapt to the app. name -> hash route (or path).
const PAGES: Record<string, string> = {
  home: "/#/",
  // "run-overview": "/#/run/<some-id>/overview",
  // "worst-case-transcript": "/#/run/<biggest-run>/coder",
};

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

async function main() {
  const { existsSync, mkdirSync } = await import("node:fs");
  mkdirSync(outDir, { recursive: true });
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[console] ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

  for (const [name, route] of Object.entries(PAGES)) {
    const t0 = Date.now();
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400); // let lazy renders settle
    console.log(`${name}: loaded in ${Date.now() - t0}ms`);
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  }

  await browser.close();
  if (errors.length) {
    console.error(`\n${errors.length} console/page error(s):`);
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  console.log(`\nOK — screenshots in ${outDir}. Now actually look at them.`);
}

main();
