// Connect to the dev Chromium over CDP and screenshot the Pinterest tab.
import { chromium } from 'playwright-core';
const [,, out = 'shots/feed.png', url] = process.argv;
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('pinterest')) || ctx.pages()[0];
if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
console.log(page.url(), await page.title());
await browser.close();
