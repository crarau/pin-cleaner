import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const boxes = page.getByRole('textbox');
const fields = [
  ['Single purpose', 'Clean up and curate Pinterest: hide ads, video and AI-generated pins, filter pins by color and shape, and save chosen images into folders with full-resolution export.'],
  ['storage', 'Saves the user\'s settings (which pins to hide, color and shape filters) and the images they pick, with their folders, locally in the browser. Nothing is sent anywhere.'],
  ['downloads', 'Saves the images the user picked to their computer when they press Download JPGs or Download ZIP in the extension\'s library page.'],
  ['host', 'Pinterest pages (pinterest.com and its regional domains): the content script hides ads, video and AI-generated pins and applies the user\'s color and shape filters on the pages they visit. i.pinimg.com: Pinterest\'s image server, used only to download the full-resolution original of an image the user picked when they export it.'],
];
const labelsOf = await boxes.evaluateAll(els => els.map(e => { let x = e; for (let i = 0; i < 6 && x; i++) x = x.parentElement; return (x?.innerText || '').slice(0, 40).replace(/\n/g, ' '); }));
console.log(labelsOf);
for (let i = 0; i < 4; i++) await boxes.nth(i).fill(fields[i][1]);
await page.getByRole('radio', { name: /No, I am not using remote code/ }).check();
for (const re of [/do not sell or transfer/, /unrelated to my item/, /creditworthiness/]) await page.getByRole('checkbox', { name: re }).check();
await boxes.last().fill('https://github.com/crarau/pin-cleaner/blob/main/docs/privacy.md');
await page.locator('button').filter({ hasText: /^Save draft$/ }).click();
await page.waitForTimeout(4000);
console.log('remote:', await page.getByRole('radio', { name: /No, I am not using remote code/ }).isChecked());
console.log('checked boxes:', await page.getByRole('checkbox').evaluateAll(a => a.map(c => (c.checked ? 'x ' : '. ') + (c.getAttribute('aria-label') || c.closest('mat-checkbox, label, div')?.innerText.slice(0, 40))).join(' | ')));
console.log((await page.evaluate(() => document.body.innerText)).match(/(saved|error)[^\n]{0,100}/gi));
await browser.close();
