import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
await page.getByRole('dialog').getByLabel('Email address').fill('chip@ideaplaces.com');
await page.getByRole('button', { name: 'Verify email address' }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'shots/cws-email2.png' });
console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 900));
await browser.close();
