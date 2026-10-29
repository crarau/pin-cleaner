// Capture Pinterest JSON responses while scrolling and report keys that look like AI / ad / video flags.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const url = process.argv[2];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const bodies = [];
page.on('response', async r => {
  if (!/\/resource\/|graphql|_\/_\//.test(r.url())) return;
  try { bodies.push({ url: r.url().slice(0, 120), body: await r.text() }); } catch {}
});
await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(1500); }
const html = await page.content();
writeFileSync('shots/net.json', JSON.stringify(bodies)); writeFileSync('shots/page.html', html);
const keys = {};
const walk = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 30) return;
  for (const [k, v] of Object.entries(o)) { if (/(^|_)ai(_|$)|gen_?ai|generat|ai_?mod|synthetic|is_promoted|promoted_is|is_video|ad_match/i.test(k)) { const s = JSON.stringify(v); keys[k] = keys[k] || {}; keys[k][s?.slice(0, 60)] = (keys[k][s?.slice(0, 60)] || 0) + 1; } walk(v, d + 1); } };
for (const b of bodies) { try { walk(JSON.parse(b.body)); } catch {} }
const m = html.match(/<script[^>]*id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/) || html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (m) { try { walk(JSON.parse(m[1])); } catch (e) { console.log('initial parse fail', e.message); } }
console.log('responses', bodies.length, bodies.map(b => b.url.replace(/\?.*/, '')).filter((v, i, a) => a.indexOf(v) === i));
console.log(JSON.stringify(keys, null, 1));
await browser.close();
