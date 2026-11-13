#!/bin/sh
# Общая установка подготовленного дистрибутива. Вызывается локальными install.sh.
# После установки CLI ставит web-генератор (`dsbuilder toolchain install web`), если не задан
# DSBUILDER_WITHOUT_WEB=1: этот шаг нуждается в npm и сети и не отменяет установку CLI.
set -eu

SOURCE=$1
KIND=$2
IOS_ARCHIVE=${3:-}
IOS_TAG=${4:-}
INSTALL_DIR=${DSBUILDER_INSTALL_DIR:-"$HOME/.dsbuilder/cli/$KIND"}
BIN_DIR=${DSBUILDER_BIN_DIR:-"$HOME/.local/bin"}
case "$INSTALL_DIR" in /*) ;; *) echo 'Install directory must be absolute' >&2; exit 1 ;; esac
case "$BIN_DIR" in /*) ;; *) echo 'Bin directory must be absolute' >&2; exit 1 ;; esac
[ "$INSTALL_DIR" != / ] && [ "$INSTALL_DIR" != "$HOME" ] || exit 1
[ ! -L "$INSTALL_DIR" ] || { echo 'Install directory must not be a symlink' >&2; exit 1; }
if [ "$KIND" = jvm ]; then
    [ -f "$SOURCE/bin/dsbuilder" ] && [ -d "$SOURCE/lib" ] || { echo 'Invalid JVM distribution' >&2; exit 1; }
    JAVA_COMMAND=${JAVA_HOME:+"$JAVA_HOME/bin/java"}
    JAVA_COMMAND=${JAVA_COMMAND:-java}
    JAVA_VERSION=$("$JAVA_COMMAND" -version 2>&1) || { echo 'Java 17+ is required' >&2; exit 1; }
    JAVA_MAJOR=$(printf '%s\n' "$JAVA_VERSION" | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)
    [ -n "$JAVA_MAJOR" ] && [ "$JAVA_MAJOR" -ge 17 ] || { echo 'Java 17+ is required' >&2; exit 1; }
else
    [ -f "$SOURCE" ] || { echo 'Cannot find bundled dsbuilder binary' >&2; exit 1; }
fi
IOS_ROOT="$HOME/.dsbuilder/toolchains/ios"
IOS_TARGET="$IOS_ROOT/$IOS_TAG"
if [ -n "$IOS_ARCHIVE" ]; then
    [ "$KIND" = macos ] && [ -f "$IOS_ARCHIVE" ] || { echo 'Invalid bundled iOS CLI archive' >&2; exit 1; }
    case "$IOS_TAG" in ''|current|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) echo 'Invalid bundled iOS CLI release tag' >&2; exit 1 ;; esac
    [ ! -L "$IOS_TARGET" ] || { echo 'iOS CLI version must not be a symlink' >&2; exit 1; }
    if [ -e "$IOS_ROOT/current" ] && [ ! -L "$IOS_ROOT/current" ]; then
        echo 'iOS CLI current must be a symlink' >&2
        exit 1
    fi
fi
mkdir -p "$(dirname "$INSTALL_DIR")" "$BIN_DIR"
WORK=$(mktemp -d "$(dirname "$INSTALL_DIR")/.dsbuilder-install.XXXXXX")
LINK_WORK=$(mktemp -d "$BIN_DIR/.dsbuilder-link.XXXXXX")
HAD_OLD=0
REPLACED=0
LINK_REPLACED=0
OLD_LINK_TARGET=
IOS_ATTEMPTED=0
IOS_HAD_OLD=0
IOS_OLD_LINK_TARGET=
SUCCESS=0
cleanup() {
    if [ "$SUCCESS" = 0 ]; then
        if [ "$IOS_ATTEMPTED" = 1 ]; then
            rm -f "$IOS_ROOT/current"
            rm -rf "$IOS_TARGET"
            if [ "$IOS_HAD_OLD" = 1 ]; then mv "$WORK/old-ios" "$IOS_TARGET"; fi
            if [ -n "$IOS_OLD_LINK_TARGET" ]; then ln -s "$IOS_OLD_LINK_TARGET" "$IOS_ROOT/current"; fi
        fi
        if [ "$LINK_REPLACED" = 1 ]; then
            rm -f "$COMMAND_PATH"
            if [ -n "$OLD_LINK_TARGET" ]; then ln -s "$OLD_LINK_TARGET" "$COMMAND_PATH"; fi
        fi
        if [ "$REPLACED" = 1 ]; then rm -rf "$INSTALL_DIR"; fi
        if [ "$HAD_OLD" = 1 ]; then mv "$WORK/old" "$INSTALL_DIR"; fi
    fi
    rm -rf "$WORK" "$LINK_WORK"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
COMMAND_PATH="$BIN_DIR/dsbuilder"
if [ -d "$COMMAND_PATH" ] || { [ -e "$COMMAND_PATH" ] && [ ! -L "$COMMAND_PATH" ]; }; then
    echo "Refusing to replace directory or non-symlink: $COMMAND_PATH" >&2
    exit 1
fi
if [ -L "$COMMAND_PATH" ]; then OLD_LINK_TARGET=$(readlink "$COMMAND_PATH"); fi
mkdir "$WORK/new"
if [ -d "$INSTALL_DIR" ]; then cp -R "$INSTALL_DIR/." "$WORK/new/"; fi
if [ "$KIND" = jvm ]; then
    rm -rf "$WORK/new/bin" "$WORK/new/lib"
    cp -R "$SOURCE/bin" "$SOURCE/lib" "$WORK/new/"
    chmod 755 "$WORK/new/bin/dsbuilder"
    EXECUTABLE="$INSTALL_DIR/bin/dsbuilder"
else
    # Не следуем по ссылке dsbuilder, скопированной из старой установки.
    rm -f "$WORK/new/dsbuilder"
    cp "$SOURCE" "$WORK/new/dsbuilder"
    chmod 755 "$WORK/new/dsbuilder"
    EXECUTABLE="$INSTALL_DIR/dsbuilder"
fi
ln -s "$EXECUTABLE" "$LINK_WORK/dsbuilder"
if [ -d "$INSTALL_DIR" ]; then mv "$INSTALL_DIR" "$WORK/old"; HAD_OLD=1; fi
mv "$WORK/new" "$INSTALL_DIR"
REPLACED=1
# Ссылки на каталоги отвергнуты до замены установки.
mv -f "$LINK_WORK/dsbuilder" "$COMMAND_PATH"
LINK_REPLACED=1
if [ -n "$IOS_ARCHIVE" ]; then
    mkdir -p "$IOS_ROOT"
    if [ -L "$IOS_ROOT/current" ]; then IOS_OLD_LINK_TARGET=$(readlink "$IOS_ROOT/current"); fi
    if [ -d "$IOS_TARGET" ]; then mv "$IOS_TARGET" "$WORK/old-ios"; IOS_HAD_OLD=1; fi
    IOS_ATTEMPTED=1
    "$EXECUTABLE" toolchain install ios --version "$IOS_TAG" --from "$IOS_ARCHIVE"
fi
SUCCESS=1
printf 'Installed dsbuilder to %s\n' "$EXECUTABLE"
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) printf 'Add %s to PATH to use dsbuilder in a new terminal.\n' "$BIN_DIR" ;;
esac
if [ "${DSBUILDER_WITHOUT_WEB:-0}" = 1 ]; then
    :
elif ! command -v npm >/dev/null 2>&1; then
    printf '%s\n' 'Warning: npm was not found, the React generator was not installed.' \
        'Install Node.js 22+ and run: dsbuilder toolchain install web' >&2
elif ! "$EXECUTABLE" toolchain install web; then
    printf '%s\n' 'Warning: the React generator was not installed, see the output above.' \
        'dsbuilder is installed. Retry with: dsbuilder toolchain install web' >&2
fi
