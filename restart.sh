#!/bin/bash
# Stop the dev Chromium, wait until it has fully exited (a new launch otherwise hands off to the
# dying instance and exits), then launch it again with the current extension.
DIR="$(cd "$(dirname "$0")" && pwd)"
PID=$(cat "$DIR/.chrome.pid" 2>/dev/null)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in $(seq 1 50); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
fi
"$DIR/launch.sh" "$@"
for _ in $(seq 1 50); do curl -s http://127.0.0.1:9333/json/version >/dev/null && break; sleep 0.2; done
