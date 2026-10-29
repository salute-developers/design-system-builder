#!/usr/bin/env bash
set -euo pipefail

cd /workspace
if [[ -z "${DSBUILDER_WEB_API_META:-}" && ! -f js/cli/.sdds/web/web-api-meta.json && ! -d js/cli/node_modules/@salutejs/plasma-new-hope ]]; then
  npm --prefix js/cli ci
fi

exec bash backend-kt/bootstrap-base.sh
