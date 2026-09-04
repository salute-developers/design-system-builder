#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
INSTALL_DIR=${DSBUILDER_INSTALL_DIR:-"$HOME/.dsbuilder/cli/macos"}
BIN_DIR=${DSBUILDER_BIN_DIR:-"$HOME/.local/bin"}
SOURCE_BINARY="$SCRIPT_DIR/dsbuilder"
INSTALLED_BINARY="$INSTALL_DIR/dsbuilder"
COMMAND_PATH="$BIN_DIR/dsbuilder"

if [ ! -f "$SOURCE_BINARY" ]; then
    echo "Cannot find bundled dsbuilder binary at $SOURCE_BINARY" >&2
    exit 1
fi

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
cp "$SOURCE_BINARY" "$INSTALLED_BINARY"
chmod 755 "$INSTALLED_BINARY"
ln -sf "$INSTALLED_BINARY" "$COMMAND_PATH"

echo "Installed dsbuilder to $INSTALLED_BINARY"
echo "Linked command to $COMMAND_PATH"

case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        echo "Add $BIN_DIR to PATH to run dsbuilder from any directory."
        echo "For zsh, run: echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc"
        ;;
esac
