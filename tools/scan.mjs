// Scroll a Pinterest page and collect every distinct pin marker: test-ids, footer text, aria labels.
import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
if (url) { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); }
const seen = new Map(), ids = {}, texts = {}, aria = {};
for (let i = 0; i < 12; i++) {
  const batch = await page.evaluate(() => [...document.querySelectorAll('[data-grid-item]')].map(it => ({
    key: it.querySelector('a')?.getAttribute('href'),
    ids: [...new Set([...it.querySelectorAll('[data-test-id]')].map(e => e.dataset.testId))],
    text: it.querySelector('[data-test-id="pinrep-footer"]')?.innerText.replace(/\s+/g, ' ') || it.innerText.replace(/\s+/g,' ').slice(0,60),
    aria: [...it.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(a => !/pin page$/.test(a)),
  })));
  for (const b of batch) if (!seen.has(b.key)) seen.set(b.key, b);
  await page.mouse.wheel(0, 2500); await page.waitForTimeout(1200);
}
for (const b of seen.values()) {
  b.ids.forEach(x => ids[x] = (ids[x] || 0) + 1);
  if (b.text) texts[b.text] = (texts[b.text] || 0) + 1;
  b.aria.forEach(x => aria[x] = (aria[x] || 0) + 1);
}
console.log(JSON.stringify({ pins: seen.size, ids, aria, texts: Object.keys(texts).slice(0, 60) }, null, 1));
await browser.close();
