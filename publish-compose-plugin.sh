#!/usr/bin/env bash
# Compose shortcut of ./publish-preview-plugin.sh, kept for existing instructions and scripts:
#   ./publish-compose-plugin.sh --from path/to/preview-compose-plugin.zip
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/publish-preview-plugin.sh" --platform compose "$@"
