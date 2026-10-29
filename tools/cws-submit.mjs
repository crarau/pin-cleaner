import { chromium } from 'playwright-core';
const go = process.argv[2] === 'go';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const btn = page.locator('button').filter({ hasText: /^Submit for review$/ }).first();
console.log('submit enabled:', await btn.isEnabled());
await btn.click();
await page.waitForTimeout(2500);
const dlg = page.getByRole('dialog').last();
console.log('DIALOG:', (await dlg.innerText()).replace(/\n+/g, ' | '));
console.log('checkboxes:', await dlg.locator('input[type=checkbox]').evaluateAll(a => a.map(c => c.checked)));
await page.screenshot({ path: 'shots/cws-submit.png' });
if (go) {
  await dlg.locator('button').filter({ hasText: /^Submit for review$/i }).click();
  await page.waitForTimeout(6000);
  const t = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
  console.log('AFTER:', t.slice(0, 500));
} else await page.keyboard.press('Escape');
await browser.close();
