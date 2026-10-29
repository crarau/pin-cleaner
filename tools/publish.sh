#!/bin/bash
# Publish Pin Cleaner to the Chrome Web Store through the API, as the keyless
# chrome-web-store-publisher service account (impersonated by ideaplaces-ops).
#   ./tools/publish.sh          build, upload the store zip, submit for review
#   ./tools/publish.sh status   show the current submission
#   ./tools/publish.sh cancel   withdraw a submission that is pending review
set -euo pipefail
cd "$(dirname "$0")/.."
PUB=71392977-7748-4840-b554-8859b1923563
ITEM=pjnldnkophmedfilcbpoeniioiccomah
API=https://chromewebstore.googleapis.com
TOKEN=$(gcloud --configuration=ideaplaces-ops auth print-access-token \
  --impersonate-service-account=chrome-web-store-publisher@ideaplaces.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/chromewebstore)
call() { curl -sS -H "Authorization: Bearer $TOKEN" "$@"; echo; }

case "${1:-publish}" in
  status) call "$API/v2/publishers/$PUB/items/$ITEM:fetchStatus" ;;
  cancel) call -X POST "$API/v2/publishers/$PUB/items/$ITEM:cancelSubmission" ;;
  publish)
    npm test
    npm run package:store
    echo "Uploading version $(node -p 'require("./extension/manifest.json").version')"
    call -X POST -H "Content-Type: application/zip" --data-binary @pin-cleaner-store.zip \
      "$API/upload/v2/publishers/$PUB/items/$ITEM:upload"
    call -X POST -H "Content-Type: application/json" -d '{}' "$API/v2/publishers/$PUB/items/$ITEM:publish"
    ;;
  *) echo "usage: $0 [publish|status|cancel]"; exit 1 ;;
esac
