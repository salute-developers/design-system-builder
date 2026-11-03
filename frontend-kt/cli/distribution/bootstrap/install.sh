#!/bin/sh
set -eu
fail() { printf '%s\n' "$*" >&2; exit 1; }
VERSION=
TARGET=
while [ "$#" -gt 0 ]; do
    case "$1" in
        --version|--target)
            [ "$#" -ge 2 ] || fail "Missing value for $1"
            case "$1" in --version) VERSION=$2 ;; --target) TARGET=$2 ;; esac
            shift 2 ;;
        *) fail "Unknown option: $1" ;;
    esac
done
valid_version() { printf '%s\n' "$1" | LC_ALL=C grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'; }
BASE=${CLI_DOWNLOAD_BASE_URL:-'@CLI_DOWNLOAD_BASE_URL@'}
BASE=${BASE%/}
case "$BASE" in
    https://*) ;;
    http://localhost:*|http://127.0.0.1:*) ;; # Локальный тестовый сервер.
    *) fail 'CLI_DOWNLOAD_BASE_URL must be an HTTPS URL' ;;
esac
case "$BASE" in *'@'*|*'?'*|*'#'*|*' '*|*"'"*|*'"'*) fail 'Invalid download URL' ;; esac
if [ -z "$TARGET" ]; then
    case "$(uname -s):$(uname -m)" in
        Darwin:arm64|Darwin:aarch64) TARGET=macos-arm64 ;;
        Darwin:x86_64) TARGET=macos-x64 ;;
        *) fail 'Unsupported native platform. Use --target jvm explicitly on macOS/Linux.' ;;
    esac
fi
case "$TARGET" in
    macos-arm64|macos-x64) [ "$(uname -s)" = Darwin ] || fail 'macOS target requires macOS' ;;
    jvm)
        case "$(uname -s)" in Darwin|Linux) ;; *) fail 'JVM installer supports macOS/Linux' ;; esac
        JAVA_COMMAND=${JAVA_HOME:+"$JAVA_HOME/bin/java"}
        JAVA_COMMAND=${JAVA_COMMAND:-java}
        JAVA_VERSION=$("$JAVA_COMMAND" -version 2>&1) || fail 'Java 17+ is required'
        JAVA_MAJOR=$(printf '%s\n' "$JAVA_VERSION" | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)
        [ -n "$JAVA_MAJOR" ] && [ "$JAVA_MAJOR" -ge 17 ] || fail 'Java 17+ is required' ;;
    *) fail "Unsupported target: $TARGET" ;;
esac
for tool in unzip zipinfo awk sed grep mktemp; do command -v "$tool" >/dev/null || fail "Required tool missing: $tool"; done
if command -v curl >/dev/null; then DOWNLOADER=curl
elif command -v wget >/dev/null; then DOWNLOADER=wget
else fail 'curl or wget is required'; fi
if command -v shasum >/dev/null; then HASH=shasum
elif command -v sha256sum >/dev/null; then HASH=sha256sum
else fail 'shasum or sha256sum is required'; fi
WORK=$(mktemp -d "${TMPDIR:-/tmp}/dsbuilder-download.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
download() {
    if [ "$DOWNLOADER" = curl ]; then
        curl --fail --silent --show-error --location --max-redirs 0 --retry 2 --connect-timeout 15 --max-time 300 "$1" -o "$2"
    else
        wget --quiet --max-redirect=0 --timeout=30 --tries=3 -O "$2" "$1"
    fi
}
if [ -z "$VERSION" ]; then
    download "$BASE/stable.json" "$WORK/stable.json"
    # stable.json имеет фиксированный контракт из двух полей; произвольный JSON не исполняется.
    STABLE=$(tr -d ' \t\r\n' < "$WORK/stable.json")
    VERSION=$(printf '%s' "$STABLE" | sed -n 's/^{"schemaVersion":1,"version":"\([0-9.]*\)"}$/\1/p')
fi
valid_version "$VERSION" || fail 'Invalid release version or stable manifest'
ARCHIVE="dsbuilder-cli-$TARGET.zip"
download "$BASE/releases/$VERSION/SHA256SUMS" "$WORK/SHA256SUMS"
EXPECTED=$(awk -v name="$ARCHIVE" '$2 == name {print $1}' "$WORK/SHA256SUMS")
printf '%s\n' "$EXPECTED" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$' || fail 'Invalid or missing archive checksum'
download "$BASE/releases/$VERSION/$ARCHIVE" "$WORK/archive.zip"
if [ "$HASH" = shasum ]; then ACTUAL=$(shasum -a 256 "$WORK/archive.zip" | awk '{print $1}')
else ACTUAL=$(sha256sum "$WORK/archive.zip" | awk '{print $1}'); fi
[ "$EXPECTED" = "$ACTUAL" ] || fail 'Archive SHA-256 mismatch'
unzip -Z1 "$WORK/archive.zip" > "$WORK/entries"
ROOT=$(head -n 1 "$WORK/entries" | cut -d / -f 1)
printf '%s\n' "$ROOT" | LC_ALL=C grep -Eq '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' || fail 'Invalid archive root'
if [ "$TARGET" != jvm ]; then [ "$ROOT" = "dsbuilder-cli-$TARGET" ] || fail 'Unexpected archive root'; fi
awk -v root="$ROOT/" '
    index($0, root) != 1 || $0 ~ /(^|\/)\.\.?($|\/)|\\|:/ {exit 1}
    $0 !~ /^[A-Za-z0-9_.\/-]+$/ {exit 1}
' "$WORK/entries" || fail 'Unsafe archive path'
zipinfo -l "$WORK/archive.zip" > "$WORK/modes"
if grep -Eq '^l' "$WORK/modes"; then fail 'Archive symlinks are not allowed'; fi
mkdir "$WORK/extracted"
unzip -q "$WORK/archive.zip" -d "$WORK/extracted"
PACKAGE="$WORK/extracted/$ROOT"
[ -f "$PACKAGE/install.sh" ] && [ -f "$PACKAGE/install-unix-common.sh" ] || fail 'Archive installer missing'
if [ "$TARGET" = jvm ]; then
    [ -f "$PACKAGE/bin/dsbuilder" ] && [ -d "$PACKAGE/lib" ] || fail 'Invalid JVM archive'
else
    [ -f "$PACKAGE/dsbuilder" ] || fail 'Native binary missing'
fi
sh "$PACKAGE/install.sh"
