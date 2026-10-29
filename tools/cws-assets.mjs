import { chromium } from 'playwright-core';
import { resolve } from 'path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const slot = i => page.locator('input[type=file]').nth(i);
await slot(0).setInputFiles(resolve('extension/icons/128.png'));
await page.waitForTimeout(4000);
for (const f of ['1-clean', '2-filter', '3-pick', '4-library']) {
  await slot(1).setInputFiles(resolve(`store/${f}.jpg`));
  await page.waitForTimeout(4000);
}
await slot(2).setInputFiles(resolve('store/promo-440x280.jpg'));
await page.waitForTimeout(4000);
const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
console.log(text.slice(text.indexOf('Graphic assets'), text.indexOf('Graphic assets') + 900));
const errs = await page.locator('[class*=error], mat-error').allInnerTexts();
console.log('errors:', errs.filter(Boolean));
await browser.close();
