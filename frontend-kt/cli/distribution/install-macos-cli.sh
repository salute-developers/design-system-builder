#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
SKIP_IOS=0
SOURCE=
# Флаги отказа принимаются в любом порядке; первый аргумент без флага — путь к бинарнику (локальный контур).
for argument in "$@"; do
    case "$argument" in
        --without-ios) SKIP_IOS=1 ;;
        --without-web) DSBUILDER_WITHOUT_WEB=1; export DSBUILDER_WITHOUT_WEB ;;
        -*) echo "Unknown option: $argument" >&2; exit 1 ;;
        *) [ -z "$SOURCE" ] || { echo "Unexpected argument: $argument" >&2; exit 1; }; SOURCE=$argument ;;
    esac
done
SOURCE=${SOURCE:-"$SCRIPT_DIR/dsbuilder"}
IOS_TAG_FILE="$SCRIPT_DIR/ios-release.txt"
if [ "$SKIP_IOS" = 0 ] && [ -f "$IOS_TAG_FILE" ]; then
    IOS_TAG=$(cat "$IOS_TAG_FILE")
    case "$IOS_TAG" in
        ''|current|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) echo 'Invalid bundled iOS CLI release tag' >&2; exit 1 ;;
    esac
    IOS_ARCHIVE="$SCRIPT_DIR/ios/dsbuilder-ios-cli-$IOS_TAG.zip"
    [ -f "$IOS_ARCHIVE" ] || { echo 'Bundled iOS CLI archive is missing' >&2; exit 1; }
    exec sh "$SCRIPT_DIR/install-unix-common.sh" "$SOURCE" macos "$IOS_ARCHIVE" "$IOS_TAG"
fi
exec sh "$SCRIPT_DIR/install-unix-common.sh" "$SOURCE" macos
