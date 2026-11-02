#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
IOS_TAG_FILE="$SCRIPT_DIR/ios-release.txt"
if [ -f "$IOS_TAG_FILE" ]; then
    IOS_TAG=$(cat "$IOS_TAG_FILE")
    case "$IOS_TAG" in
        ''|current|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) echo 'Invalid bundled iOS CLI release tag' >&2; exit 1 ;;
    esac
    IOS_ARCHIVE="$SCRIPT_DIR/ios/dsbuilder-ios-cli-$IOS_TAG.zip"
    [ -f "$IOS_ARCHIVE" ] || { echo 'Bundled iOS CLI archive is missing' >&2; exit 1; }
    exec sh "$SCRIPT_DIR/install-unix-common.sh" "${1:-$SCRIPT_DIR/dsbuilder}" macos "$IOS_ARCHIVE" "$IOS_TAG"
fi
exec sh "$SCRIPT_DIR/install-unix-common.sh" "${1:-$SCRIPT_DIR/dsbuilder}" macos
