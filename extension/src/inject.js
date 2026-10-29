// Runs in the page's own world at document_start. Pinterest renders a virtualized masonry grid, so a
// pin hidden after layout leaves a hole. Instead this script removes filtered pins from the data
// before Pinterest sees it: the initial state embedded in the HTML and every /resource/ XHR. Pinterest then
// lays out only what remains, with no gaps. Every pin seen is also reported to the content script.
(function () {
  const PC = window.PC;
  const TAG = 'pin-cleaner';
  const SETTINGS_KEY = 'pinCleanerSettings';

  // The content script mirrors settings into localStorage so they are readable synchronously here,
  // before Pinterest's first request.
  // Until the content script has mirrored them once (the very first visit), the install defaults
  // apply, so ads are already filtered on the first page load.
  let settings = { ...PC.DEFAULTS };
  let picked = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings = { ...PC.DEFAULTS, ...(saved.settings || {}) };
    picked = new Set(saved.picked || []);
  } catch (e) { /* defaults */ }

  const seen = new Map();
  const removed = { ad: 0, video: 0, ai: 0, color: 0, aspect: 0 };
  const removedIds = new Set();

  function decide(rec) {
    return PC.hideReason({ ...rec, color: PC.colorBucket(rec.color), aspect: PC.aspectOf(rec.w, rec.h) }, settings, picked.has(rec.id));
  }

  function process(json) {
    const pins = PC.extractPins(json);
    for (const p of pins) seen.set(p.id, PC.mergeRecord(seen.get(p.id), p));
    const gone = PC.filterPins(json, v => decide(seen.get(String(v.id)) || PC.extractPins(v)[0]));
    for (const g of gone) { removed[g.reason]++; removedIds.add(g.id); }
    const changed = gone.length > 0;
    if (pins.length) window.postMessage({ source: TAG, pins, removed }, location.origin);
    return changed;
  }

  const isPinData = url => /\/resource\//.test(url || '');
  const textDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
  const respDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__pcUrl = String(url);
    return open.call(this, method, url, ...rest);
  };

  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (isPinData(this.__pcUrl)) {
      const xhr = this;
      let text = null;
      let obj = null;
      const filteredText = () => {
        if (text === null) {
          const raw = textDesc.get.call(xhr);
          try {
            const json = JSON.parse(raw);
            text = process(json) ? JSON.stringify(json) : raw;
          } catch (e) { text = raw; }
        }
        return text;
      };
      Object.defineProperty(xhr, 'responseText', {
        configurable: true,
        get() { return xhr.readyState === 4 ? filteredText() : textDesc.get.call(xhr); },
      });
      Object.defineProperty(xhr, 'response', {
        configurable: true,
        get() {
          if (xhr.readyState !== 4) return respDesc.get.call(xhr);
          if (xhr.responseType === '' || xhr.responseType === 'text') return filteredText();
          if (xhr.responseType === 'json') {
            if (obj === null) { obj = respDesc.get.call(xhr); if (obj) process(obj); }
            return obj;
          }
          return respDesc.get.call(xhr);
        },
      });
    }
    return send.apply(this, args);
  };

  // The first page of pins is embedded as JSON in the HTML and read by an inline script right after
  // it, before any observer callback could rewrite the tag. So the filter hooks JSON.parse: the
  // moment Pinterest parses its initial Redux state, filtered pins leave the result lists.
  // Search and board pages also arrive server-rendered: the grid markup already holds every pin.
  // Filtered pins are taken out of that markup too, so it matches the filtered state when Pinterest
  // hydrates it, and grid items the parser adds later are checked as they arrive.
  function purgeMarkup(root) {
    if (!removedIds.size) return;
    for (const el of root.querySelectorAll('[data-test-pin-id]')) {
      if (!removedIds.has(el.getAttribute('data-test-pin-id'))) continue;
      const item = el.closest('[data-grid-item]');
      if (item) item.remove();
    }
  }
  const parse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const out = parse.call(this, text, reviver);
    if (out && typeof out === 'object' && !Array.isArray(out) && (out.initialReduxState || (out.props && out.props.initialReduxState))) {
      try { process(out); purgeMarkup(document); } catch (e) { /* never break Pinterest's own parse */ }
    }
    return out;
  };
  const markupWatch = new MutationObserver(() => purgeMarkup(document));
  markupWatch.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => markupWatch.disconnect(), { once: true });

  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.source !== TAG) return;
    if (e.data.type === 'replay') window.postMessage({ source: TAG, pins: [...seen.values()], removed }, location.origin);
    if (e.data.type === 'settings') { settings = e.data.settings || {}; picked = new Set(e.data.picked || []); }
  });
})();
