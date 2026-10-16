#!/usr/bin/env bash
# SHA-256 fingerprints of the Preview Protocol schema and the shared fixtures (CONTRACT.sha256).
#
#   fingerprint.sh --write            recompute CONTRACT.sha256
#   fingerprint.sh --check            fail when CONTRACT.sha256 does not match the files
#   fingerprint.sh --sync-to <dir>    copy the schema and fixtures into a plasma-android
#                                     `integration-core/preview-contract/src/commonMain/resources`
#                                     directory (fixtures go to fixtures/v1/shared) and rewrite its schemas/v1/DIGEST
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fingerprint_file="$root/CONTRACT.sha256"

if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
else
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
fi

contract_files() {
  (cd "$root" && LC_ALL=C find schemas/v1/preview-payload.schema.json fixtures/v1/valid fixtures/v1/invalid -type f -name '*.json' | LC_ALL=C sort)
}

render() {
  local path
  while IFS= read -r path; do
    printf '%s  %s\n' "$(sha256 "$root/$path")" "$path"
  done < <(contract_files)
}

case "${1:-}" in
  --write)
    render > "$fingerprint_file"
    echo "Updated $fingerprint_file"
    ;;
  --check)
    if ! diff <(render) "$fingerprint_file" >/dev/null; then
      echo "CONTRACT.sha256 does not match the contract files:" >&2
      diff <(render) "$fingerprint_file" >&2 || true
      echo "Run backend-kt/preview/contract/fingerprint.sh --write and commit the result." >&2
      exit 1
    fi
    echo "CONTRACT.sha256 is up to date"
    ;;
  --sync-to)
    target="${2:?usage: fingerprint.sh --sync-to <plasma resources dir>}"
    [ -d "$target/schemas/v1" ] || { echo "$target/schemas/v1 not found" >&2; exit 2; }
    rm -rf "$target/fixtures/v1/shared"
    mkdir -p "$target/fixtures/v1/shared"
    cp "$root/schemas/v1/preview-payload.schema.json" "$target/schemas/v1/"
    cp -R "$root/fixtures/v1/valid" "$root/fixtures/v1/invalid" "$target/fixtures/v1/shared/"
    render | sed -E 's#  fixtures/v1/#  fixtures/v1/shared/#' > "$target/schemas/v1/DIGEST"
    echo "Synced into $target"
    ;;
  *)
    echo "usage: fingerprint.sh --write | --check | --sync-to <dir>" >&2
    exit 2
    ;;
esac
