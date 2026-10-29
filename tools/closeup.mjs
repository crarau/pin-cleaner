// Open pin pages, capture their JSON, and print fields that look like AI labels plus any visible "AI" text.
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
for (const id of process.argv.slice(2)) {
  const found = new Set();
  const h = async r => { if (!/resource|graphql/.test(r.url())) return;
    try { const t = await r.text(); for (const m of t.matchAll(/"([a-z_]*(?:gen_?ai|ai_|_ai\b|genai|synthetic|disclos|c2pa|provenan)[a-z_]*)"\s*:\s*([^,}\]]{0,60})/gi)) found.add(m[1] + '=' + m[2]); } catch {} };
  page.on('response', h);
  await page.goto(`https://ca.pinterest.com/pin/${id}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  page.off('response', h);
  const html = await page.content();
  for (const m of html.matchAll(/"([a-z_]*(?:gen_?ai|ai_|genai|synthetic|disclos|c2pa|provenan)[a-z_]*)"\s*:\s*([^,}\]]{0,60})/gi)) found.add(m[1] + '=' + m[2]);
  const vis = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /AI[- ]?(modified|generated)|IA/i.test(e.textContent) && e.textContent.length < 60).map(e => e.textContent.trim() + ' <' + e.tagName + ' ' + (e.closest('[data-test-id]')?.dataset.testId || '') + '>'));
  console.log(id, [...found], vis);
}
await browser.close();
