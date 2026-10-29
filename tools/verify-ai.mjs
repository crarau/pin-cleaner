// Open each visible pin's closeup and report whether Pinterest labels it "AI modified".
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-grid-item] a[href*="/pin/"]')].map(a => /\/pin\/(\d+)/.exec(a.getAttribute('href'))?.[1]).filter(Boolean))]);
let labeled = 0; const n = Math.min(ids.length, +(process.argv[3] || 12));
for (const id of ids.slice(0, n)) {
  await page.goto(`https://ca.pinterest.com/pin/${id}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  const ai = await page.evaluate(() => !!document.querySelector('[data-test-id="closeup-body-image-container"] [data-test-id="ai-generated-label"]'));
  if (ai) labeled++;
  console.log(id, ai ? 'AI LABEL' : 'clean');
}
console.log(`${labeled} of ${n} visible pins carry Pinterest's AI label`);
await browser.close();
