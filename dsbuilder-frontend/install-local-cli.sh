#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
REQUESTED_ARCH=${DSBUILDER_MACOS_ARCH:-$(uname -m)}

case "$REQUESTED_ARCH" in
    arm64 | aarch64 | macosArm64)
        TARGET_NAME="macosArm64"
        TASK_NAME="linkReleaseExecutableMacosArm64"
        ;;
    x86_64 | amd64 | x64 | macosX64)
        TARGET_NAME="macosX64"
        TASK_NAME="linkReleaseExecutableMacosX64"
        ;;
    *)
        echo "Unsupported macOS architecture: $REQUESTED_ARCH" >&2
        echo "Use DSBUILDER_MACOS_ARCH=arm64 or DSBUILDER_MACOS_ARCH=x64." >&2
        exit 1
        ;;
esac

INSTALL_ROOT=${DSBUILDER_INSTALL_ROOT:-"$HOME/.dsbuilder/cli"}
BIN_DIR=${DSBUILDER_BIN_DIR:-"$HOME/.local/bin"}
INSTALL_DIR="$INSTALL_ROOT/$TARGET_NAME"
BINARY_PATH="$SCRIPT_DIR/cli/build/bin/$TARGET_NAME/releaseExecutable/dsbuilder.kexe"
INSTALLED_BINARY="$INSTALL_DIR/dsbuilder"
COMMAND_PATH="$BIN_DIR/dsbuilder"

cd "$SCRIPT_DIR"
./gradlew ":cli:$TASK_NAME"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
cp "$BINARY_PATH" "$INSTALLED_BINARY"
chmod 755 "$INSTALLED_BINARY"
ln -sf "$INSTALLED_BINARY" "$COMMAND_PATH"

echo "Installed dsbuilder to $INSTALLED_BINARY"
echo "Linked command to $COMMAND_PATH"

case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        echo "Add $BIN_DIR to PATH to run dsbuilder from any directory."
        SHELL_NAME=$(basename "${SHELL:-/bin/bash}")
        case "$SHELL_NAME" in
            zsh)
                CONFIG_FILE="$HOME/.zshrc"
                echo "Adding $BIN_DIR to PATH in $CONFIG_FILE ..."
                if ! grep -q "$BIN_DIR" "$CONFIG_FILE" 2>/dev/null; then
                    echo '' >> "$CONFIG_FILE"
                    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$CONFIG_FILE"
                else
                    echo "$BIN_DIR is already in $CONFIG_FILE, skipping."
                fi
                echo "Then run: source $CONFIG_FILE"
                ;;
            bash)
                # bash reads ~/.bashrc for interactive shells, ~/.bash_profile for login shells
                CONFIG_FILE="$HOME/.bashrc"
                if [ ! -f "$CONFIG_FILE" ] && [ -f "$HOME/.bash_profile" ]; then
                    CONFIG_FILE="$HOME/.bash_profile"
                fi
                echo "Adding $BIN_DIR to PATH in $CONFIG_FILE ..."
                if ! grep -q "$BIN_DIR" "$CONFIG_FILE" 2>/dev/null; then
                    echo '' >> "$CONFIG_FILE"
                    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$CONFIG_FILE"
                else
                    echo "$BIN_DIR is already in $CONFIG_FILE, skipping."
                fi
                echo "Then run: source $CONFIG_FILE"
                ;;
            *)
                echo "Your shell ($SHELL_NAME) is not automatically detected."
                echo "Add the following line to your shell config (~/.bashrc, ~/.zshrc, etc.):"
                echo "export PATH=\"$BIN_DIR:\$PATH\""
                ;;
        esac
        ;;
esac
