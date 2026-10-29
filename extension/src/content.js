// Isolated-world content script. Owns the settings, the on-page panel, the pick button on every pin
// and the DOM fallback: anything the data filter in inject.js could not remove (signals only visible
// in the DOM, or a setting changed after the grid rendered) is hidden here.
(function () {
  const PC = globalThis.PC;
  const TAG = 'pin-cleaner';
  const SETTINGS_KEY = 'pinCleanerSettings';
  const DEFAULTS = PC.DEFAULTS;

  let settings = { ...DEFAULTS };
  let picks = {};
  let meta = new Map();
  let removed = { ad: 0, video: 0, ai: 0, color: 0, aspect: 0 };
  let staleLayout = false;

  function mirrorToPage() {
    const picked = Object.keys(picks);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, picked })); } catch (e) { /* storage blocked */ }
    window.postMessage({ source: TAG, type: 'settings', settings, picked }, location.origin);
  }

  async function load() {
    const sync = await chrome.storage.sync.get('settings');
    const local = await chrome.storage.local.get('picks');
    settings = { ...DEFAULTS, ...(sync.settings || {}) };
    picks = local.picks || {};
    mirrorToPage();
  }

  async function saveSettings(patch) {
    const before = settings;
    settings = { ...settings, ...patch };
    const filterChanged = ['hideAds', 'hideVideo', 'hideAI', 'colors', 'aspects'].some(k => JSON.stringify(before[k]) !== JSON.stringify(settings[k]));
    if (filterChanged) staleLayout = true;
    mirrorToPage();
    await chrome.storage.sync.set({ settings });
    schedule();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.picks) { picks = changes.picks.newValue || {}; mirrorToPage(); schedule(); }
    if (area === 'sync' && changes.settings) { settings = { ...DEFAULTS, ...changes.settings.newValue }; mirrorToPage(); schedule(); }
  });

  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.source !== TAG || !e.data.pins) return;
    for (const p of e.data.pins) meta.set(p.id, PC.mergeRecord(meta.get(p.id), p));
    if (e.data.removed) removed = e.data.removed;
    schedule();
  });

  // ---- reading a grid item ----

  function pinIdOf(item) {
    const a = item.querySelector('a[href*="/pin/"]');
    const m = a && /\/pin\/(\d+)/.exec(a.getAttribute('href'));
    return m ? m[1] : null;
  }

  function readItem(item) {
    const id = pinIdOf(item);
    const m = (id && meta.get(id)) || {};
    const img = item.querySelector('img');
    const ad = m.ad || !!item.querySelector('[data-test-id="otpp"], [aria-label="Sponsored"], [aria-label^="Sponsored;"]');
    const video = m.video || !!item.querySelector('[data-test-id="pinrep-video"], [data-test-id="web-video-player"], video');
    const ai = m.ai || !!item.querySelector('[data-test-id="ai-generated-label"]');
    let hex = m.color;
    if (!hex) {
      const bg = item.querySelector('[style*="background-color"]');
      hex = bg ? PC.rgbToHex(bg.style.backgroundColor) : null;
    }
    const w = m.w || (img && img.naturalWidth), h = m.h || (img && img.naturalHeight);
    const thumb = img ? (img.currentSrc || img.src) : null;
    return {
      id, ad, video, ai,
      color: PC.colorBucket(hex), hex,
      aspect: PC.aspectOf(w, h), w, h,
      thumb,
      orig: m.orig || PC.originalFromThumb(thumb),
      title: m.title || (img && img.alt) || '',
    };
  }

  // ---- picks ----

  async function togglePick(item) {
    const p = readItem(item);
    if (!p.id) return;
    const local = await chrome.storage.local.get(['picks', 'folders']);
    const all = local.picks || {};
    if (all[p.id]) delete all[p.id];
    else {
      all[p.id] = { id: p.id, title: p.title, thumb: p.thumb, orig: p.orig, w: p.w, h: p.h, hex: p.hex, folder: settings.folder, savedAt: Date.now() };
      const folders = local.folders || ['Unsorted'];
      if (!folders.includes(settings.folder)) await chrome.storage.local.set({ folders: [...folders, settings.folder] });
    }
    await chrome.storage.local.set({ picks: all });
  }

  // The pick button lives in the row under the pin, left of Pinterest's "..." menu: that space is
  // empty on organic pins, and the image itself is covered by Pinterest's own hover buttons.
  // Absolutely positioned so the pin's height, which Pinterest has already laid out, never changes.
  function ensurePickButton(item) {
    if (item.querySelector(':scope .pc-pick')) return;
    const b = document.createElement('button');
    b.className = 'pc-pick';
    b.type = 'button';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); togglePick(item); }, true);
    const host = item.querySelector('[data-test-id="pinrep-footer"]') || item.querySelector('[data-test-id="pinWrapper"]') || item;
    host.style.position = host.style.position || 'relative';
    host.appendChild(b);
  }

  // ---- the pass over the grid ----

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; pass(); });
  }

  function pass() {
    let domHidden = 0;
    for (const item of document.querySelectorAll('[data-grid-item]')) {
      const p = readItem(item);
      const picked = !!(p.id && picks[p.id]);
      const reason = PC.hideReason(p, settings, picked);
      if (reason) { item.dataset.pcHidden = reason; domHidden++; } else delete item.dataset.pcHidden;
      item.classList.toggle('pc-picked', picked);
      if (p.id) ensurePickButton(item);
      const btn = item.querySelector('.pc-pick');
      const mark = picked ? '✓ Picked' : '+ Pick';
      if (btn && btn.textContent !== mark) {
        btn.textContent = mark;
        btn.title = picked
          ? `In your Pin Cleaner library, folder ${picks[p.id].folder}. Click to remove it.`
          : 'Save this image to your Pin Cleaner library. Picked images always stay visible, whatever your filters.';
      }
    }
    renderPanel(domHidden);
  }

  // ---- the panel ----

  let shadow = null;
  function buildPanel() {
    const host = document.createElement('div');
    host.id = 'pin-cleaner-panel';
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<link rel="stylesheet" href="${chrome.runtime.getURL('src/panel.css')}"><div class="root"></div>`;
    shadow.addEventListener('click', onPanelClick);
    shadow.addEventListener('change', onPanelChange);
  }

  function total(o) { return Object.values(o).reduce((a, b) => a + b, 0); }

  let lastPanel = '';
  function renderPanel(domHidden) {
    if (!shadow) return;
    const sig = JSON.stringify([settings, removed, domHidden, Object.keys(picks).length, staleLayout]);
    if (sig === lastPanel) return;
    lastPanel = sig;
    const root = shadow.querySelector('.root');
    const hiddenCount = total(removed) + domHidden;
    const pickCount = Object.keys(picks).length;
    if (!settings.panelOpen) {
      root.innerHTML = `<button class="pill" data-act="open"><span class="dot"></span>Pin Cleaner<span class="count">${hiddenCount} hidden</span></button>`;
      return;
    }
    const toggle = (key, label, n) => `<label class="row"><input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''}><span>${label}</span><span class="n">${n || ''}</span></label>`;
    const swatches = PC.COLORS.map(([name, hex]) => `<button class="sw ${settings.colors.includes(name) ? 'on' : ''}" data-color="${name}" title="${name}" style="--c:${hex}"></button>`).join('');
    const aspects = ['portrait', 'square', 'landscape'].map(a => `<button class="chip ${settings.aspects.includes(a) ? 'on' : ''}" data-aspect="${a}"><i class="shape ${a}"></i>${a[0].toUpperCase() + a.slice(1)}</button>`).join('');
    root.innerHTML = `
      <div class="card">
        <header><strong>Pin Cleaner</strong><button class="x" data-act="close" title="Collapse">−</button></header>
        <section>
          <h4>Hide</h4>
          ${toggle('hideAds', 'Ads', removed.ad)}
          ${toggle('hideVideo', 'Video', removed.video)}
          ${toggle('hideAI', 'AI-generated', removed.ai)}
        </section>
        <section>
          <h4>Color <button class="link" data-act="clear-colors">${settings.colors.length ? 'Clear' : ''}</button></h4>
          <div class="swatches">${swatches}</div>
        </section>
        <section>
          <h4>Shape <button class="link" data-act="clear-aspects">${settings.aspects.length ? 'Clear' : ''}</button></h4>
          <div class="chips">${aspects}</div>
        </section>
        ${staleLayout ? `<button class="notice" data-act="reload">Refresh the page to apply your filters</button>` : ''}
        <section>
          <h4>Picks go to</h4>
          <div class="folder"><select data-key="folder"></select><button class="link" data-act="new-folder">New</button></div>
          <button class="primary" data-act="library">Open library (${pickCount})</button>
        </section>
      </div>`;
    fillFolders(root.querySelector('select'));
  }

  async function fillFolders(select) {
    const { folders } = await chrome.storage.local.get('folders');
    const list = folders && folders.length ? folders : ['Unsorted'];
    if (!list.includes(settings.folder)) list.push(settings.folder);
    select.innerHTML = list.map(f => `<option ${f === settings.folder ? 'selected' : ''}>${f.replace(/</g, '&lt;')}</option>`).join('');
  }

  async function onPanelClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'open') return saveSettings({ panelOpen: true });
    if (act === 'close') return saveSettings({ panelOpen: false });
    if (act === 'reload') return location.reload();
    if (act === 'library') return chrome.runtime.sendMessage({ type: 'open-library' });
    if (act === 'clear-colors') return saveSettings({ colors: [] });
    if (act === 'clear-aspects') return saveSettings({ aspects: [] });
    if (act === 'new-folder') {
      const name = (prompt('New folder name') || '').trim();
      if (!name) return;
      const { folders } = await chrome.storage.local.get('folders');
      const list = folders && folders.length ? folders : ['Unsorted'];
      if (!list.includes(name)) await chrome.storage.local.set({ folders: [...list, name] });
      return saveSettings({ folder: name });
    }
    if (t.dataset.color) {
      const c = t.dataset.color;
      return saveSettings({ colors: settings.colors.includes(c) ? settings.colors.filter(x => x !== c) : [...settings.colors, c] });
    }
    if (t.dataset.aspect) {
      const a = t.dataset.aspect;
      return saveSettings({ aspects: settings.aspects.includes(a) ? settings.aspects.filter(x => x !== a) : [...settings.aspects, a] });
    }
  }

  function onPanelChange(e) {
    const key = e.target.dataset.key;
    if (!key) return;
    saveSettings({ [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  }

  // ---- start ----

  async function start() {
    await load();
    window.postMessage({ source: TAG, type: 'replay' }, location.origin);
    const boot = () => {
      buildPanel();
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      schedule();
    };
    if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  }
  start();
})();
