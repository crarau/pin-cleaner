import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
if (process.argv[3]) { await page.goto(process.argv[3], { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); }
await page.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1200, height: 800 } });
await browser.close();
