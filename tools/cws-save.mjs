import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const btns = await page.getByRole('button').allInnerTexts();
console.log(btns.filter(t => t.trim()).join(' / '));
const save = page.getByRole('button', { name: /^Save/ });
if (await save.count()) { await save.first().click(); await page.waitForTimeout(2500); console.log('saved'); }
console.log('name now:', await page.getByLabel('Publisher display name*').inputValue());
await browser.close();
