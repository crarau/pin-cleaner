import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const cdp = await page.context().newCDPSession(page);
const ctxs = [];
cdp.on('Runtime.executionContextCreated', e => ctxs.push(e.context));
await cdp.send('Runtime.enable');
await new Promise(r => setTimeout(r, 500));
for (const c of ctxs.filter(c => c.auxData?.type === 'isolated' || c.name)) {
  const r = await cdp.send('Runtime.evaluate', { expression: 'typeof PC + " " + typeof globalThis.PC + " " + (typeof chrome !== "undefined" && !!chrome.runtime?.id)', contextId: c.id });
  console.log(c.name || '(main)', c.auxData?.type, c.auxData?.frameId === page.mainFrame()._guid ? '' : '', r.result.value);
}
await browser.close();
