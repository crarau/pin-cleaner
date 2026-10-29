// Scroll a grid, record digital_media_source_type per pin from the API, then open a sample
// of each value and check whether Pinterest shows its own "AI modified" label on the closeup.
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const src = new Map();
const walk = o => { if (!o || typeof o !== 'object') return;
  if (o.type === 'pin' && o.id && /^\d+$/.test(o.id) && !o.is_promoted) { const v = !('digital_media_source_type' in o) ? 'absent' : o.digital_media_source_type === null ? 'null' : o.digital_media_source_type; const prev = src.get(String(o.id)); if (prev === undefined || prev === 'absent') src.set(String(o.id), v); }
  Object.values(o).forEach(walk); };
page.on('response', async r => { if (/\/resource\//.test(r.url())) try { walk(JSON.parse(await r.text())); } catch {} });
for (const q of process.argv.slice(2)) {
  await page.goto(`https://ca.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(1200); }
}
const byVal = {};
for (const [id, v] of src) (byVal[v] ??= []).push(id);
console.log('values', Object.fromEntries(Object.entries(byVal).map(([k, a]) => [k, a.length])));
const results = {};
for (const [v, ids] of Object.entries(byVal)) for (const id of ids.slice(0, v === "null" ? 12 : 3)) {
  await page.goto(`https://ca.pinterest.com/pin/${id}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500); const labeled = await page.evaluate(() => { const e = document.querySelector("[data-test-id=\"ai-generated-label\"]"); return !!e && e.getBoundingClientRect().width > 0; });
  (results[v] ??= []).push(id + (labeled ? ":AI" : ":-"));
}
console.log(JSON.stringify(results));
await browser.close();
