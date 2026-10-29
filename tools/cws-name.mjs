import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const name = page.getByLabel('Publisher display name*');
await name.fill('IdeaPlaces');
await name.press('Tab');
await page.waitForTimeout(1000);
const buttons = await page.locator('button, [role=button]').evaluateAll(els => els.filter(e => e.offsetParent).map(e => e.innerText.trim()).filter(Boolean));
console.log('buttons:', buttons.join(' / '));
const save = page.locator('button, [role=button]').filter({ hasText: /^Save( changes)?$/ });
if (await save.count()) { await save.first().click(); await page.waitForTimeout(3000); console.log('clicked save'); }
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
console.log('after reload:', await page.getByLabel('Publisher display name*').inputValue());
await browser.close();
