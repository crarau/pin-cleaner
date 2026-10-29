// The library page: picks grouped into folders, moved between them, exported in full resolution.
const PC = globalThis.PC;
const $ = id => document.getElementById(id);
const ALL = '__all__';

let picks = {};
let folders = ['Unsorted'];
let current = ALL;
const selected = new Set();

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function load() {
  const data = await chrome.storage.local.get(['picks', 'folders']);
  picks = data.picks || {};
  folders = data.folders && data.folders.length ? data.folders : ['Unsorted'];
  for (const p of Object.values(picks)) if (!folders.includes(p.folder)) folders.push(p.folder);
  render();
}

function visible() {
  return Object.values(picks).filter(p => current === ALL || p.folder === current).sort((a, b) => b.savedAt - a.savedAt);
}

function render() {
  const counts = {};
  for (const p of Object.values(picks)) counts[p.folder] = (counts[p.folder] || 0) + 1;
  $('folders').innerHTML = [[ALL, 'All picks', Object.keys(picks).length], ...folders.map(f => [f, f, counts[f] || 0])]
    .map(([key, label, n]) => `<button data-folder="${esc(key)}" class="${key === current ? 'on' : ''}">${esc(label)}<span>${n}</span></button>`).join('');
  $('folder-title').textContent = current === ALL ? 'All picks' : current;
  $('folder-actions').innerHTML = current === ALL || current === 'Unsorted' ? '' :
    `<button class="link" data-act="rename">Rename</button> <button class="link" data-act="delete">Delete folder</button>`;

  const list = visible();
  for (const id of [...selected]) if (!picks[id]) selected.delete(id);
  const options = f => folders.map(x => `<option ${x === f ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('grid').innerHTML = list.map(p => `
    <div class="card ${selected.has(p.id) ? 'sel' : ''}" data-id="${p.id}">
      <input type="checkbox" class="check" ${selected.has(p.id) ? 'checked' : ''}>
      <a href="https://www.pinterest.com/pin/${p.id}/" target="_blank" rel="noopener"><img loading="lazy" src="${esc(p.thumb || p.orig)}" alt="${esc(p.title)}"></a>
      <div class="meta">
        <div class="t" title="${esc(p.title)}">${esc(p.title || 'Untitled')}</div>
        <div class="row"><select data-move>${options(p.folder)}</select><button class="link" data-remove>Remove</button></div>
        ${p.w ? `<div class="dims">${Number(p.w) || ''} × ${Number(p.h) || ''}</div>` : ''}
      </div>
    </div>`).join('');
  $('empty').hidden = list.length > 0;
  $('select-all').checked = list.length > 0 && list.every(p => selected.has(p.id));
}

async function save() {
  await chrome.storage.local.set({ picks, folders });
}

// The panel on Pinterest files new picks into settings.folder; keep it pointing at a folder that exists.
async function retargetPanel(from, to) {
  const { settings } = await chrome.storage.sync.get('settings');
  if (settings && settings.folder === from) await chrome.storage.sync.set({ settings: { ...settings, folder: to } });
}

$('folders').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  current = b.dataset.folder;
  selected.clear();
  render();
});

$('new-folder').addEventListener('click', async () => {
  const name = (prompt('New folder name') || '').trim();
  if (!name || folders.includes(name)) return;
  folders.push(name);
  await save();
  current = name;
  render();
});

$('folder-actions').addEventListener('click', async e => {
  const act = e.target.dataset.act;
  if (act === 'rename') {
    const name = (prompt('Rename folder', current) || '').trim();
    if (!name || folders.includes(name)) return;
    folders = folders.map(f => (f === current ? name : f));
    for (const p of Object.values(picks)) if (p.folder === current) p.folder = name;
    await retargetPanel(current, name);
    current = name;
  }
  if (act === 'delete') {
    if (!confirm(`Delete "${current}"? Its picks move to Unsorted.`)) return;
    for (const p of Object.values(picks)) if (p.folder === current) p.folder = 'Unsorted';
    folders = folders.filter(f => f !== current);
    await retargetPanel(current, 'Unsorted');
    current = ALL;
  }
  await save();
  render();
});

$('grid').addEventListener('change', async e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  if (e.target.matches('.check')) {
    if (e.target.checked) selected.add(id); else selected.delete(id);
    return render();
  }
  if (e.target.matches('[data-move]')) {
    picks[id].folder = e.target.value;
    await save();
    render();
  }
});

$('grid').addEventListener('click', async e => {
  if (!e.target.matches('[data-remove]')) return;
  delete picks[e.target.closest('.card').dataset.id];
  await save();
  render();
});

$('select-all').addEventListener('change', e => {
  for (const p of visible()) if (e.target.checked) selected.add(p.id); else selected.delete(p.id);
  render();
});

// ---- export ----

function targets() {
  const list = visible();
  const chosen = list.filter(p => selected.has(p.id));
  return chosen.length ? chosen : list;
}

// Fetch the original image and return { data: JPEG bytes, reduced }. When Pinterest refuses the
// original, the 736px rendition is used and reported as reduced, never passed off as full size.
async function fetchJpeg(p) {
  const originals = [...new Set([p.orig, PC.originalFromThumb(p.thumb)].filter(Boolean))];
  const fallback = p.thumb && p.thumb.replace(/\/(\d+x|originals)\//, '/736x/');
  let blob = null;
  let reduced = false;
  for (const url of [...originals, fallback].filter(Boolean)) {
    try {
      const res = await fetch(url);
      if (res.ok) { blob = await res.blob(); reduced = !originals.includes(url); break; }
    } catch (e) { /* try the next size */ }
  }
  if (!blob) throw new Error(`could not download ${p.id}`);
  if (blob.type === 'image/jpeg') return { data: new Uint8Array(await blob.arrayBuffer()), reduced };
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  return { data: new Uint8Array(await jpeg.arrayBuffer()), reduced };
}

function fileNames(list) {
  const used = new Set();
  return list.map(p => {
    let base = `${PC.safeName(p.folder, 'Unsorted')}/${PC.safeName(p.title, 'pin')}-${p.id}`;
    while (used.has(base)) base += '_';
    used.add(base);
    return base + '.jpg';
  });
}

function summary(saved, reduced, failed) {
  const parts = [`Done: ${saved} image${saved === 1 ? '' : 's'} saved`];
  if (reduced) parts.push(`${reduced} at reduced size because Pinterest did not provide the original`);
  if (failed) parts.push(`${failed} could not be downloaded`);
  return parts.join(', ') + '.';
}

async function exportAll(asZip) {
  const list = targets();
  if (!list.length) return;
  const buttons = [$('export-jpg'), $('export-zip')];
  buttons.forEach(b => { b.disabled = true; });
  const names = fileNames(list);
  const files = [];
  let failed = 0;
  let reduced = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      $('status').textContent = `Downloading ${i + 1} of ${list.length} in full resolution…`;
      try {
        const img = await fetchJpeg(list[i]);
        if (img.reduced) reduced++;
        if (asZip) files.push({ name: names[i], data: img.data });
        else await saveBlob(new Blob([img.data], { type: 'image/jpeg' }), `Pin Cleaner/${names[i]}`);
      } catch (e) {
        console.warn('[pin-cleaner] export failed for', list[i].id, e);
        failed++;
      }
    }
    if (asZip && files.length) {
      $('status').textContent = 'Building the ZIP…';
      const label = current === ALL ? 'All picks' : current;
      await saveBlob(new Blob([PC.makeZip(files)], { type: 'application/zip' }), `Pin Cleaner/${PC.safeName(label, 'picks')}.zip`);
    }
    $('status').textContent = summary(list.length - failed, reduced, failed);
  } catch (e) {
    console.error('[pin-cleaner] export failed', e);
    $('status').textContent = `Export failed: ${e.message}`;
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

$('export-jpg').addEventListener('click', () => exportAll(false));
$('export-zip').addEventListener('click', () => exportAll(true));
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') load(); });
load();
