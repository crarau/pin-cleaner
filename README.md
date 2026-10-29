# Pin Cleaner

A Chrome extension that cleans up Pinterest and turns it into a moodboard tool.

- **Hide ads, video and AI-generated images** with one click each.
- **Filter any Pinterest page by color and shape** (portrait, square, landscape), including search results, boards and the "more like this" grid under a pin.
- **Pick any image** with the + button on each pin, even one your filters would hide.
- **Organize picks into folders.**
- **Export in full resolution**, as separate JPGs or one ZIP per folder.

Hidden pins are removed before Pinterest lays out the grid, so the grid stays packed with no empty holes.

## Install

Pin Cleaner is not in the Chrome Web Store, so it is installed by hand. It takes about a minute.

1. Download **pin-cleaner.zip** from the [latest release](https://github.com/crarau/pin-cleaner/releases/latest).
2. Double-click the zip to unzip it. You get a folder called **pin-cleaner**. Move it somewhere it can stay (Documents is fine). Chrome loads the extension from this folder, so do not delete it.
3. In Chrome, open a new tab and go to `chrome://extensions`.
4. Turn on **Developer mode** (the switch in the top right corner).
5. Click **Load unpacked** and choose the **pin-cleaner** folder.
6. Open [pinterest.com](https://www.pinterest.com). A black **Pin Cleaner** button appears in the bottom right corner.

Optional: click the puzzle piece icon next to the address bar and pin Pin Cleaner, so the library is one click away.

To update later, download the new zip, replace the folder's contents, and press the reload arrow on Pin Cleaner in `chrome://extensions`.

## Use

- **Panel:** click **Pin Cleaner** in the bottom right corner of Pinterest. Tick what to hide, pick one or more colors, pick one or more shapes. Ads are hidden by default.
- **When you change a filter**, pins already on screen are hidden in place. Refresh the page (the panel offers a button) and the grid is rebuilt without gaps.
- **Picking:** hover any pin and press the **+** in its top left corner. It turns red and the pin stays visible whatever your filters say. Press it again to un-pick.
- **Folders:** in the panel, "Picks go to" chooses the folder for new picks. **New** creates one.
- **Library:** **Open library** in the panel, or the Pin Cleaner icon in the toolbar. Move picks between folders, rename or delete folders, remove picks.
- **Export:** in the library, **Download ZIP** saves the folder you are looking at as one zip (or only the ticked images). **Download JPGs** saves each image separately. Both download the original full-size image and convert it to JPG when Pinterest stores it in another format. Files land in your Downloads folder under **Pin Cleaner**.

Everything stays in your browser. Nothing is sent anywhere.

## How it works

Findings from inspecting Pinterest's live feed, which the code relies on:

| What | Signal | Evidence |
|------|--------|----------|
| Ad | `is_promoted` on the pin in Pinterest's data; `data-test-id="otpp"` or `aria-label="Sponsored"` in the DOM | `otpp` appeared on exactly the 62 sponsored pins in a 213 pin feed sample |
| AI-generated | `digital_media_source_type` is set (an IPTC DigitalSourceType code: 11, 12, 16 or 18 observed); `data-test-id="ai-generated-label"` on a pin's page | Every sampled pin with the field carried Pinterest's own "AI modified" label on its page; after filtering, 0 of 11 remaining pins did |
| Video | `is_video` / `videos` in the data; `pinrep-video`, `web-video-player` or a `<video>` in the DOM | |
| Color | `dominant_color`, bucketed into 12 swatches by hue and lightness | |
| Shape | `images.orig` width and height (portrait above 1.1, landscape below 0.9) | |

Pinterest's grid is a virtualized masonry: about 20 pins are mounted at a time, each absolutely positioned. Hiding a pin after layout leaves a hole, so the extension filters the data instead:

- `src/inject.js` runs in the page's own world at `document_start`. It wraps `XMLHttpRequest` (every `/resource/` call) and `JSON.parse` (the initial Redux state embedded in the HTML) and removes filtered pins from the result lists before Pinterest renders them.
- Search and board pages arrive server-rendered. Filtered pins are also taken out of that markup before Pinterest hydrates it.
- A page of results is never emptied: an empty first page makes Pinterest show "no Pins found" and stop loading. One pin is kept as filler and hidden.
- `src/content.js` runs in the extension's world: settings, the panel, pick buttons, and a DOM fallback for anything visible only in the DOM.
- `src/library.js` is the library page. It fetches originals from `i.pinimg.com` (the only host permission) and writes ZIPs with `src/zip.js`.

`src/pindata.main.js` is a build copy of `src/pindata.js` for the page world (Chrome injects a file listed in two content script entries only once). `npm run build` refreshes it and a unit test fails if they drift.

## Develop

```bash
npm ci
npm test                 # unit tests (also refreshes pindata.main.js)
./launch.sh              # Chrome for Testing with a dedicated profile, the extension loaded, CDP on 9333
./restart.sh             # restart it after a change
node test/e2e.mjs https://www.pinterest.com/ 10      # live check: fails if any ad is visible
node test/e2e-picks.mjs                              # live check: folder, picks, library, ZIP export
npm run package          # builds pin-cleaner.zip for a release
```

The end-to-end checks drive the dev browser over CDP and need a logged-in Pinterest session in its profile. `tools/` holds the scripts used to reverse-engineer Pinterest's markup and data (`groundtruth.mjs` is the AI label check).

Chrome for Testing is used because branded Chrome no longer accepts `--load-extension` from the command line.

## Limits

- Pinterest changes its markup and data often. The signals above were verified in October 2026.
- A few video pins are only detectable in the DOM; those leave a small gap until the next refresh.
- An AI-generated pin whose grid data lacks the source-type field is not caught in the grid (1 of 3 sampled such pins was labeled AI on its own page). Pinterest's own "Less AI" chip on search results can be combined with Pin Cleaner.
