#!/bin/bash
# Launch the dev Chromium with its own profile, the extension loaded, and CDP on 9333.
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="$HOME/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CHROME" --user-data-dir="$DIR/.profile" --remote-debugging-port=9333 \
  --load-extension="$DIR/extension" --disable-extensions-except="$DIR/extension" \
  --no-first-run --no-default-browser-check --window-size=1440,1000 \
  "${1:-https://www.pinterest.com/login/}" > /tmp/pinterest-chrome.log 2>&1 &
echo $! > "$DIR/.chrome.pid"
