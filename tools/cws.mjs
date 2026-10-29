// Drive the Chrome Web Store dashboard tab: node tools/cws.mjs [url] [shot]
import { chromium } from 'playwright-core';
const [url, shot = 'shots/cws.png'] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('webstore/devconsole')) || await ctx.newPage();
if (url) { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000); }
await page.screenshot({ path: shot });
console.log(page.url());
console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 1200));
await browser.close();
