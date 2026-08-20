#!/usr/bin/env bash
set -euo pipefail

buildId="${BUILD_ID:-}"
echo "BUILD_ID is $buildId"
if [[ -z "$buildId" ]]; then
  echo "❌ BUILD_ID is not set"
  exit 1
fi

mkdir -p /shared/designsystem/library
cp -r "/tmp/builds/${buildId}/payloads/"* /work/designsystem/library/ || true

exec /usr/local/bin/main.sh "$@"