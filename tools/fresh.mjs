import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.argv[2] || 9444));
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => ({
  panel: document.getElementById('pin-cleaner-panel')?.shadowRoot?.textContent.trim(),
  pins: document.querySelectorAll('[data-grid-item]').length,
  pickButtons: document.querySelectorAll('.pc-pick').length,
  visibleAds: [...document.querySelectorAll('[data-grid-item]')].filter(i => !i.dataset.pcHidden && i.querySelector('[data-test-id="otpp"]')).length,
}))));
await browser.close();
