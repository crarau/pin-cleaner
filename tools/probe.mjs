// Evaluate a JS file inside the Pinterest tab and print the JSON result.
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
if (process.argv[3]) { await page.goto(process.argv[3], { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); }
const r = await page.evaluate(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(r, null, 1));
await browser.close();
