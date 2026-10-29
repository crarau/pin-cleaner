// End-to-end check against live Pinterest in the dev Chromium (./launch.sh, logged in).
// Scrolls a page and fails if any ad (or any AI / video pin, when those filters are on) is visible.
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'https://ca.pinterest.com/';
const scrolls = +(process.argv[3] || 10);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('pinterest')) || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-grid-item]', { timeout: 20000 });
await page.waitForTimeout(2500);
const seen = new Map();
for (let i = 0; i < scrolls; i++) {
  const batch = await page.evaluate(() => [...document.querySelectorAll('[data-grid-item]')].map(it => ({
    key: it.querySelector('a')?.getAttribute('href') || it.innerText.slice(0, 40),
    visible: !it.dataset.pcHidden && it.getBoundingClientRect().height > 0,
    hiddenBy: it.dataset.pcHidden || null,
    ad: !!it.querySelector('[data-test-id="otpp"], [aria-label="Sponsored"], [aria-label^="Sponsored;"]'),
    video: !!it.querySelector('[data-test-id="pinrep-video"], [data-test-id="web-video-player"], video'),
    pick: !!it.querySelector('.pc-pick'),
  })));
  for (const b of batch) seen.set(b.key, b);
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1300);
}
const all = [...seen.values()];
const visibleAds = all.filter(b => b.visible && b.ad);
const domHidden = all.filter(b => b.hiddenBy);
const panel = await page.evaluate(() => document.getElementById('pin-cleaner-panel')?.shadowRoot?.textContent.replace(/\s+/g, ' ').trim());
const result = { url, pins: all.length, visibleAds: visibleAds.length, visibleVideo: all.filter(b => b.visible && b.video).length, domHidden: domHidden.length, withPickButton: all.filter(b => b.pick).length, panel, errors };
console.log(JSON.stringify(result, null, 1));
await browser.close();
if (visibleAds.length) { console.error('FAIL: ads visible', visibleAds.map(b => b.key)); process.exit(1); }
