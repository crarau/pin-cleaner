import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const r = await page.evaluate(async () => { const t = await (await fetch(location.href, { credentials: 'include' })).text(); return { len: t.length, gridItems: (t.match(/data-grid-item/g) || []).length, otpp: (t.match(/otpp/g) || []).length }; });
console.log(r); await browser.close();
