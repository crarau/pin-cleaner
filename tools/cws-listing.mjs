// Fill the store listing tab: description, category, language, icon, screenshots, promo tile.
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
await page.bringToFront();
await page.getByRole('textbox', { name: /Description/ }).first().fill(readFileSync('store/description.txt', 'utf8'));

async function pick(labelRe, optionRe) {
  await page.locator('mat-select, [role=combobox]').filter({ hasText: labelRe }).first().click();
  await page.waitForTimeout(800);
  const opts = await page.getByRole('option').allInnerTexts();
  console.log(labelRe, 'options:', opts.slice(0, 40).join(' | '));
  const o = page.getByRole('option', { name: optionRe }).first();
  if (await o.count()) { await o.click(); } else { await page.keyboard.press('Escape'); }
  await page.waitForTimeout(500);
}
await pick(/Select a category/, /Art & Design/);
await pick(/Select a language/, /^English \(United States\)|^English$/);

const inputs = page.locator('input[type=file]');
console.log('file inputs:', await inputs.count());
const labels = await inputs.evaluateAll(els => els.map(e => (e.closest('section, div[class*=asset], div')?.innerText || '').slice(0, 60).replace(/\n/g, ' ')));
console.log(labels);
await browser.close();
