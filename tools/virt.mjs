import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
await page.goto('https://ca.pinterest.com/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
for (let i = 0; i < 10; i++) {
  const s = await page.evaluate(() => { const ys = [...document.querySelectorAll('[data-grid-item]')].map(e => +(/translateY\(([\d.]+)px/.exec(e.style.transform) || [0, 0])[1]); const c = document.querySelector('[data-grid-item]')?.parentElement; return { n: ys.length, minY: Math.min(...ys), maxY: Math.max(...ys), scroll: Math.round(scrollY), contH: c?.style.height }; });
  console.log(JSON.stringify(s));
  await page.mouse.wheel(0, 3000); await page.waitForTimeout(1200);
}
await browser.close();
