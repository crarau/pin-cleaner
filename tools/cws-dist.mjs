import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('webstore/devconsole'));
const desc = () => page.evaluate(() => [...document.querySelectorAll('input[type=radio], input[type=checkbox]')].map((i, n) => { let x = i; for (let k = 0; k < 3; k++) x = x.parentElement; return n + (i.checked ? ' X ' : ' . ') + x.innerText.trim().slice(0, 40).replace(/\n/g, ' '); }));
console.log((await desc()).join('\n'));
await browser.close();
