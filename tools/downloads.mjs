import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const lib = browser.contexts()[0].pages().find(p => p.url().includes('library.html'));
console.log(JSON.stringify(await lib.evaluate(async () => (await chrome.downloads.search({ orderBy: ['-startTime'], limit: 5 })).map(d => ({ file: d.filename, state: d.state, bytes: d.fileSize, err: d.error }))), null, 1));
await browser.close();
