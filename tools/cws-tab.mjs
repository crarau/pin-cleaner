// Open an item tab by its sidebar link text and print the main content.
import { chromium } from 'playwright-core';
const tab = process.argv[2];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
await page.goto('https://chrome.google.com/u/1/webstore/devconsole/71392977-7748-4840-b554-8859b1923563/pjnldnkophmedfilcbpoeniioiccomah/edit', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.getByRole('link', { name: tab, exact: true }).first().click().catch(async () => page.getByText(tab, { exact: true }).first().click());
await page.waitForTimeout(3500);
console.log(page.url());
const t = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
console.log(t.slice(t.indexOf('Ratings |') + 9, t.indexOf('Ratings |') + 1500));
await browser.close();
