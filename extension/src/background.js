// Opens the library page, from the panel's button or the toolbar icon.
async function openLibrary() {
  const url = chrome.runtime.getURL('library.html');
  const [tab] = await chrome.tabs.query({ url });
  if (tab) await chrome.tabs.update(tab.id, { active: true });
  else await chrome.tabs.create({ url });
}
chrome.runtime.onMessage.addListener(msg => { if (msg && msg.type === 'open-library') openLibrary(); });
chrome.action.onClicked.addListener(openLibrary);
