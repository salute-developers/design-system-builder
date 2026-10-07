#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "--port" ]; then
    if [ -z "${2:-}" ]; then
        echo "Usage: $0 [--port <port>]" >&2
        exit 1
    fi
    export API_REFERENCE_PORT="$2"
    shift 2
fi

if [ "$#" -ne 0 ]; then
    echo "Usage: $0 [--port <port>]" >&2
    exit 1
fi

if [ -n "${DS_API_REFERENCE_PROJECT_ID:-}" ]; then
    echo "Pre-filling projectId in API requests from DS_API_REFERENCE_PROJECT_ID"
fi

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_directory="$(cd "${script_directory}/.." && pwd)"
reference_directory="${backend_directory}/api-reference"

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to start API Reference" >&2
    exit 1
fi

if [ ! -d "${reference_directory}/node_modules" ]; then
    npm --prefix "${reference_directory}" ci
fi

exec npm --prefix "${reference_directory}" run start
