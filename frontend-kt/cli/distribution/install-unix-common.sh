#!/bin/sh
# Общая установка подготовленного дистрибутива. Вызывается локальными install.sh.
set -eu

SOURCE=$1
KIND=$2
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
mkdir -p "$(dirname "$INSTALL_DIR")" "$BIN_DIR"
WORK=$(mktemp -d "$(dirname "$INSTALL_DIR")/.dsbuilder-install.XXXXXX")
LINK_WORK=$(mktemp -d "$BIN_DIR/.dsbuilder-link.XXXXXX")
HAD_OLD=0
REPLACED=0
SUCCESS=0
cleanup() {
    if [ "$SUCCESS" = 0 ]; then
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
SUCCESS=1
printf 'Installed dsbuilder to %s\n' "$EXECUTABLE"
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) printf 'Add %s to PATH to use dsbuilder in a new terminal.\n' "$BIN_DIR" ;;
esac
