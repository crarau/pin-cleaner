import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const r = await page.evaluate(async () => {
  const t = await (await fetch(location.href, { credentials: 'include' })).text();
  const id = '597360338107312696';
  const ctx = []; let i = -1;
  while ((i = t.indexOf(id, i + 1)) !== -1) {
    const before = t.lastIndexOf('<script', i), close = t.lastIndexOf('</script>', i);
    const inScript = before > close ? t.slice(before, before + 90) : 'markup';
    ctx.push(inScript + ' :: ' + t.slice(i - 60, i + 20).replace(/\s+/g, ' '));
  }
  const scripts = [...t.matchAll(/<script([^>]*)>/g)].map(m => m[1].slice(0, 80)).filter(a => !/src=/.test(a));
  return { ctx: ctx.slice(0, 12), inlineScripts: scripts.slice(0, 30) };
});
console.log(JSON.stringify(r, null, 1)); await browser.close();
