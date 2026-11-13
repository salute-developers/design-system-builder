#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
SOURCE=
# `--without-ios` принимается для единообразия со сборкой macOS: iOS CLI в JVM-дистрибутиве нет.
for argument in "$@"; do
    case "$argument" in
        --without-ios) ;;
        --without-web) DSBUILDER_WITHOUT_WEB=1; export DSBUILDER_WITHOUT_WEB ;;
        -*) echo "Unknown option: $argument" >&2; exit 1 ;;
        *) [ -z "$SOURCE" ] || { echo "Unexpected argument: $argument" >&2; exit 1; }; SOURCE=$argument ;;
    esac
done
exec sh "$SCRIPT_DIR/install-unix-common.sh" "${SOURCE:-$SCRIPT_DIR}" jvm
