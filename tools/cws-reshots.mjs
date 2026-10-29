// Replace the listing screenshots with the current store/*.jpg.
import { chromium } from 'playwright-core';
import { resolve } from 'path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
await page.goto('https://chrome.google.com/u/1/webstore/devconsole/71392977-7748-4840-b554-8859b1923563/pjnldnkophmedfilcbpoeniioiccomah/edit', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const shots = () => page.locator('img').evaluateAll(a => a.filter(i => i.naturalWidth === 320).length);
console.log('screenshots before:', await shots());
for (let k = 0; k < 6 && await shots() > 0; k++) {
  const img = page.locator('img').filter({ has: page.locator(':scope') }).nth(0);
  const del = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find(i => i.naturalWidth === 320);
    let x = img; for (let i = 0; i < 6 && x; i++) { const b = x.querySelector('button[aria-label*="elete" i], button[aria-label*="emove" i]'); if (b) { b.click(); return b.getAttribute('aria-label'); } x = x.parentElement; }
    return null;
  });
  if (!del) { console.log('no delete button found'); break; }
  await page.waitForTimeout(1200);
}
console.log('screenshots after delete:', await shots());
const slot = page.locator('input[type=file]').nth(1);
for (const f of ['1-clean', '2-filter', '3-pick', '4-library']) { await slot.setInputFiles(resolve(`store/${f}.jpg`)); await page.waitForTimeout(3500); }
console.log('screenshots now:', await shots());
await page.locator('button').filter({ hasText: /^Save draft$/ }).click();
await page.waitForTimeout(3500);
console.log((await page.evaluate(() => document.body.innerText)).match(/(saved|error)[^\n]{0,60}/gi));
await browser.close();
