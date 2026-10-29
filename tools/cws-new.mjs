// Create the item: New item, upload the store zip.
import { chromium } from 'playwright-core';
import { resolve } from 'path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
await page.bringToFront();
await page.goto('https://chrome.google.com/u/1/webstore/devconsole/71392977-7748-4840-b554-8859b1923563', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const chooser = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
await page.locator('button, [role=button]').filter({ hasText: /New item/ }).first().click();
await page.waitForTimeout(2000);
let fc = await chooser;
if (!fc) {
  await page.screenshot({ path: 'shots/cws-new.png' });
  const input = page.locator('input[type=file]');
  console.log('file inputs:', await input.count());
  if (await input.count()) await input.first().setInputFiles(resolve('pin-cleaner-store.zip'));
  else {
    const fc2 = page.waitForEvent('filechooser', { timeout: 15000 });
    await page.locator('button, [role=button]').filter({ hasText: /Browse|Upload|Choose/i }).first().click();
    await (await fc2).setFiles(resolve('pin-cleaner-store.zip'));
  }
} else await fc.setFiles(resolve('pin-cleaner-store.zip'));
await page.waitForTimeout(12000);
await page.screenshot({ path: 'shots/cws-after-upload.png' });
console.log(page.url());
console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 1500));
await browser.close();
