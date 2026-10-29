const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const PC = require('../extension/src/pindata.js');
require('../extension/src/zip.js');

// Shapes taken from real /resource/ responses (trimmed).
const organic = { type: 'pin', id: '320740804736386428', is_promoted: false, is_video: false, digital_media_source_type: null, dominant_color: '#2a5d8f', grid_title: 'The River Wallpaper', images: { orig: { width: 736, height: 1308, url: 'https://i.pinimg.com/originals/aa/bb/cc/x.jpg' } } };
const ad = { type: 'pin', id: '111', is_promoted: true, promoter: { id: '9' }, dominant_color: '#ffffff' };
const video = { type: 'pin', id: '222', is_video: true, videos: { video_list: {} } };
const aiPin = { type: 'pin', id: '780882022937965721', digital_media_source_type: 16, dominant_color: '#6d7f86' };
const aiPin11 = { type: 'pin', id: '333', digital_media_source_type: 11 };

test('extractPins finds pins anywhere in a payload and reads each flag', () => {
  const payload = { resource_response: { data: { results: [organic, ad, { nested: [video, aiPin] }], extra: aiPin11 } } };
  const byId = Object.fromEntries(PC.extractPins(payload).map(p => [p.id, p]));
  assert.equal(Object.keys(byId).length, 5);
  assert.deepEqual([byId['320740804736386428'].ad, byId['320740804736386428'].video, byId['320740804736386428'].ai], [false, false, false]);
  assert.equal(byId['111'].ad, true);
  assert.equal(byId['222'].video, true);
  assert.equal(byId['780882022937965721'].ai, true);
  assert.equal(byId['333'].ai, true);
  assert.equal(byId['320740804736386428'].orig, 'https://i.pinimg.com/originals/aa/bb/cc/x.jpg');
  assert.deepEqual([byId['320740804736386428'].w, byId['320740804736386428'].h], [736, 1308]);
});

test('extractPins ignores non-pin objects but keeps token ids (promoted pins use them)', () => {
  assert.deepEqual(PC.extractPins({ type: 'board', id: '1', pins: [{ type: 'pin', id: 'AQx-token', is_promoted: true }] }).map(p => [p.id, p.ad]), [['AQx-token', true]]);
});

test('mergeRecord keeps any positive flag from either source', () => {
  const m = PC.mergeRecord({ id: '1', ad: false, video: false, ai: false, color: null }, { id: '1', ad: false, video: false, ai: true, color: '#000000' });
  assert.equal(m.ai, true);
  assert.equal(m.color, '#000000');
});

test('colorBucket maps hex to the twelve swatches', () => {
  const cases = { '#e0383e': 'red', '#f08a24': 'orange', '#f2cf2e': 'yellow', '#3fa34d': 'green', '#2bb3a8': 'teal', '#3a6fd8': 'blue', '#8a4fd1': 'purple', '#e46aa8': 'pink', '#8b5a2b': 'brown', '#111111': 'black', '#9a9a9a': 'gray', '#fafafa': 'white' };
  for (const [hex, want] of Object.entries(cases)) assert.equal(PC.colorBucket(hex), want, hex);
  assert.equal(PC.colorBucket('nope'), null);
});

test('every swatch colour classifies as its own bucket', () => {
  for (const [name, hex] of PC.COLORS) assert.equal(PC.colorBucket(hex), name);
});

test('aspectOf splits portrait, square and landscape at 10%', () => {
  assert.equal(PC.aspectOf(736, 1308), 'portrait');
  assert.equal(PC.aspectOf(1000, 1050), 'square');
  assert.equal(PC.aspectOf(1000, 1111), 'portrait');
  assert.equal(PC.aspectOf(1200, 800), 'landscape');
  assert.equal(PC.aspectOf(0, 10), null);
});

test('originalFromThumb swaps the size segment for originals', () => {
  assert.equal(PC.originalFromThumb('https://i.pinimg.com/236x/9d/e9/e6/9de9.jpg'), 'https://i.pinimg.com/originals/9d/e9/e6/9de9.jpg');
  assert.equal(PC.originalFromThumb('https://i.pinimg.com/736x/9d/e9/e6/9de9.jpg'), 'https://i.pinimg.com/originals/9d/e9/e6/9de9.jpg');
});

test('rgbToHex reads computed background colours', () => {
  assert.equal(PC.rgbToHex('rgb(42, 93, 143)'), '#2a5d8f');
  assert.equal(PC.rgbToHex(''), null);
});

test('hideReason applies each setting, and a pick always shows', () => {
  const s = { hideAds: true, hideVideo: true, hideAI: true, colors: ['blue'], aspects: ['portrait'] };
  assert.equal(PC.hideReason({ ad: true }, s, false), 'ad');
  assert.equal(PC.hideReason({ video: true }, s, false), 'video');
  assert.equal(PC.hideReason({ ai: true }, s, false), 'ai');
  assert.equal(PC.hideReason({ color: 'red', aspect: 'portrait' }, s, false), 'color');
  assert.equal(PC.hideReason({ color: 'blue', aspect: 'landscape' }, s, false), 'aspect');
  assert.equal(PC.hideReason({ color: 'blue', aspect: 'portrait' }, s, false), null);
  assert.equal(PC.hideReason({ ad: true, color: 'red' }, s, true), null);
  assert.equal(PC.hideReason({ color: null, aspect: null }, s, false), null, 'unknown colour or shape is not filtered out');
  assert.equal(PC.hideReason({ ad: true }, { hideAds: false, colors: [], aspects: [] }, false), null);
});

test('crc32 matches the reference value', () => {
  assert.equal(PC.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('makeZip produces an archive unzip accepts, with the right bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-zip-'));
  const a = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
  const b = new TextEncoder().encode('second file');
  const zip = PC.makeZip([{ name: 'Moodboard/a-1.jpg', data: a }, { name: 'Moodboard/b-2.jpg', data: b }]);
  const file = path.join(dir, 'x.zip');
  fs.writeFileSync(file, zip);
  execFileSync('unzip', ['-tq', file]);
  execFileSync('unzip', ['-q', file, '-d', dir]);
  assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(dir, 'Moodboard/a-1.jpg'))), a);
  assert.equal(fs.readFileSync(path.join(dir, 'Moodboard/b-2.jpg'), 'utf8'), 'second file');
});

test('safeName strips path separators and keeps a fallback', () => {
  assert.equal(PC.safeName('a/b:c*d', 'x'), 'a b c d');
  assert.equal(PC.safeName('   ', 'pin'), 'pin');
});

test('the page-world copy of pindata matches the source (Chrome injects a shared file only once)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/src/pindata.js'), 'utf8');
  const copy = fs.readFileSync(path.join(__dirname, '../extension/src/pindata.main.js'), 'utf8');
  assert.equal(copy, src, 'pindata.main.js is stale: run npm run build and commit it');
});

test('filterPins removes filtered pins from every list and reports why', () => {
  const payload = { resource_response: { data: { results: [organic, ad, aiPin, { type: 'story', id: 'x' }], nested: { items: [video, organic] } } } };
  const decide = v => (v.is_promoted ? 'ad' : v.is_video ? 'video' : v.digital_media_source_type != null ? 'ai' : null);
  const gone = PC.filterPins(payload, decide);
  assert.deepEqual(gone.map(g => g.id + ':' + g.reason).sort(), ['111:ad', '222:video', '780882022937965721:ai']);
  assert.deepEqual(payload.resource_response.data.results.map(r => r.id), ['320740804736386428', 'x']);
  assert.deepEqual(payload.resource_response.data.nested.items.map(r => r.id), ['320740804736386428']);
});

test('filterPins keeps the first pin of a list it would otherwise empty, so Pinterest keeps paginating', () => {
  const payload = { results: [ad, aiPin, aiPin11] };
  const gone = PC.filterPins(payload, () => 'color');
  assert.deepEqual(payload.results.map(r => r.id), ['111']);
  assert.deepEqual(gone.map(g => g.id).sort(), ['333', '780882022937965721']);
});

test('filterPins leaves the payload untouched when nothing is filtered', () => {
  const payload = { results: [organic, ad] };
  assert.deepEqual(PC.filterPins(payload, () => null), []);
  assert.equal(payload.results.length, 2);
});

test('install defaults hide ads and nothing else', () => {
  assert.deepEqual(PC.hideReason({ ad: true }, PC.DEFAULTS, false), 'ad');
  assert.equal(PC.hideReason({ video: true, ai: true, color: 'red', aspect: 'square' }, PC.DEFAULTS, false), null);
});
