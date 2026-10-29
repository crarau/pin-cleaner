// Pure helpers shared by the page-world reader, the content script, the library page and the tests.
// pindata.main.js is a build copy for the page world: Chrome injects a file listed in two
// content-script entries only once, so each world needs its own filename.
// Everything Pinterest-specific about the data shape lives here.
(function (root) {
  const PC = root.PC || (root.PC = {});

  // Pinterest sets digital_media_source_type (an IPTC DigitalSourceType code) only on pins it
  // labels "AI modified" on the closeup. null or absent means no AI signal.
  function toRecord(o) {
    const orig = o.images && o.images.orig;
    return {
      id: String(o.id),
      ad: !!(o.is_promoted || o.promoter || o.ad_match_reason > 0),
      video: !!(o.is_video || o.videos),
      ai: o.digital_media_source_type != null,
      color: typeof o.dominant_color === 'string' ? o.dominant_color : null,
      w: orig ? orig.width : null,
      h: orig ? orig.height : null,
      orig: orig ? orig.url : null,
      title: (o.grid_title || o.title || '').trim(),
    };
  }

  function mergeRecord(a, b) {
    if (!a) return b;
    return {
      id: a.id,
      ad: a.ad || b.ad,
      video: a.video || b.video,
      ai: a.ai || b.ai,
      color: a.color || b.color,
      w: a.w || b.w,
      h: a.h || b.h,
      orig: a.orig || b.orig,
      title: a.title || b.title,
    };
  }

  // Walk any Pinterest JSON payload and return one record per pin found in it.
  function extractPins(json) {
    const out = new Map();
    const stack = [json];
    let guard = 0;
    while (stack.length && guard++ < 500000) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (const v of o) stack.push(v); continue; }
      if (o.type === 'pin' && o.id) {
        const r = toRecord(o);
        out.set(r.id, mergeRecord(out.get(r.id), r));
      }
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); }
    }
    return [...out.values()];
  }

  function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
  }

  const COLORS = [
    ['red', '#e0383e'], ['orange', '#f08a24'], ['yellow', '#f2cf2e'], ['green', '#3fa34d'],
    ['teal', '#2bb3a8'], ['blue', '#3a6fd8'], ['purple', '#8a4fd1'], ['pink', '#e46aa8'],
    ['brown', '#8b5a2b'], ['black', '#1b1b1b'], ['gray', '#9a9a9a'], ['white', '#f4f4f4'],
  ];

  function colorBucket(hex) {
    const c = hexToHsl(hex);
    if (!c) return null;
    if (c.l < 0.16) return 'black';
    if (c.l > 0.88) return 'white';
    if (c.s < 0.16) return 'gray';
    const h = c.h;
    if (h >= 15 && h < 45 && c.l < 0.45) return 'brown';
    if (h < 15 || h >= 345) return 'red';
    if (h < 45) return 'orange';
    if (h < 70) return 'yellow';
    if (h < 165) return 'green';
    if (h < 195) return 'teal';
    if (h < 255) return 'blue';
    if (h < 290) return 'purple';
    return 'pink';
  }

  function aspectOf(w, h) {
    if (!w || !h) return null;
    const r = h / w;
    if (r > 1.1) return 'portrait';
    if (r < 0.9) return 'landscape';
    return 'square';
  }

  // i.pinimg.com/236x/ab/cd/ef/hash.jpg -> i.pinimg.com/originals/ab/cd/ef/hash.jpg
  function originalFromThumb(url) {
    if (!url) return null;
    return url.replace(/(https:\/\/i\.pinimg\.com\/)[^/]+\//, '$1originals/');
  }

  function rgbToHex(rgb) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
  }

  // Decide whether a pin is hidden, given its flags and the user's settings. Picks always show.
  function hideReason(pin, s, picked) {
    if (picked) return null;
    if (s.hideAds && pin.ad) return 'ad';
    if (s.hideVideo && pin.video) return 'video';
    if (s.hideAI && pin.ai) return 'ai';
    if (s.colors && s.colors.length && pin.color && !s.colors.includes(pin.color)) return 'color';
    if (s.aspects && s.aspects.length && pin.aspect && !s.aspects.includes(pin.aspect)) return 'aspect';
    return null;
  }

  // Settings a fresh install starts with, before anything is saved.
  const DEFAULTS = { hideAds: true, hideVideo: false, hideAI: false, colors: [], aspects: [], folder: 'Unsorted', panelOpen: false };

  // Remove pin objects from every array in a Pinterest payload when decide(pin) returns a reason.
  // A list is never emptied: Pinterest reads an empty first page as "no Pins found" and stops
  // loading, which a narrow colour or shape filter can easily cause. The first pin of an otherwise
  // empty list stays as filler (the content script hides it in the DOM) so pagination carries on.
  // Returns the removed pins as [{ id, reason }]; the payload is modified in place.
  function filterPins(root, decide) {
    const out = [];
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) {
        for (let i = o.length - 1; i >= 0; i--) {
          const v = o[i];
          if (v && v.type === 'pin' && v.id) {
            const reason = decide(v);
            const othersLeft = o.some((x, j) => j !== i && x && x.type === 'pin');
            if (reason && othersLeft) { o.splice(i, 1); out.push({ id: String(v.id), reason }); continue; }
          }
          if (v && typeof v === 'object') stack.push(v);
        }
      } else {
        for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); }
      }
    }
    return out;
  }

  Object.assign(PC, { extractPins, mergeRecord, colorBucket, aspectOf, originalFromThumb, rgbToHex, hideReason, filterPins, COLORS, DEFAULTS });
  if (typeof module !== 'undefined') module.exports = PC;
})(typeof globalThis !== 'undefined' ? globalThis : this);
