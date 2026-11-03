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
DSBUILDER_INSTALL_DIR=${DSBUILDER_INSTALL_DIR:-"$INSTALL_ROOT/$TARGET_NAME"}
export DSBUILDER_INSTALL_DIR
cd "$SCRIPT_DIR"
./gradlew ":cli:$TASK_NAME"
sh "$SCRIPT_DIR/cli/distribution/install-macos-cli.sh" \
    "$SCRIPT_DIR/cli/build/bin/$TARGET_NAME/releaseExecutable/dsbuilder.kexe"

# Сохраняем настройку PATH локального контура; копирование CLI выполняет общий установщик.
BIN_DIR=${DSBUILDER_BIN_DIR:-"$HOME/.local/bin"}
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        case "$(basename "${SHELL:-/bin/bash}")" in
            zsh) CONFIG_FILE="$HOME/.zshrc" ;;
            bash)
                CONFIG_FILE="$HOME/.bashrc"
                if [ ! -f "$CONFIG_FILE" ] && [ -f "$HOME/.bash_profile" ]; then CONFIG_FILE="$HOME/.bash_profile"; fi
                ;;
            *) exit 0 ;;
        esac
        # Одинарные кавычки не интерпретируют $, backticks и пробелы пользовательского пути.
        QUOTED_BIN_DIR=$(printf '%s' "$BIN_DIR" | sed "s/'/'\\\\''/g")
        PATH_LINE="export PATH='$QUOTED_BIN_DIR':\$PATH"
        if ! grep -Fqx "$PATH_LINE" "$CONFIG_FILE" 2>/dev/null; then
            printf '\n%s\n' "$PATH_LINE" >> "$CONFIG_FILE"
        fi
        printf 'Then run: source %s\n' "$CONFIG_FILE"
        ;;
esac
