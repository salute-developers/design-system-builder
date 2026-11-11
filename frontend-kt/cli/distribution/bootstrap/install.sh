#!/bin/sh
set -eu
fail() { printf '%s\n' "$*" >&2; exit 1; }
VERSION=
TARGET=
# Флаги отказа передаются установщику из архива как есть.
WITHOUT_IOS=
WITHOUT_WEB=
while [ "$#" -gt 0 ]; do
    case "$1" in
        --version|--target)
            [ "$#" -ge 2 ] || fail "Missing value for $1"
            case "$1" in --version) VERSION=$2 ;; --target) TARGET=$2 ;; esac
            shift 2 ;;
        --without-ios) WITHOUT_IOS=--without-ios; shift ;;
        --without-web) WITHOUT_WEB=--without-web; shift ;;
        *) fail "Unknown option: $1" ;;
    esac
done
valid_version() { printf '%s\n' "$1" | LC_ALL=C grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'; }
BASE=${CLI_RELEASE_BASE_URL:-'@CLI_RELEASE_BASE_URL@'}
BASE=${BASE%/}
case "$BASE" in
    https://*) ;;
    http://localhost:*|http://127.0.0.1:*) ;; # Локальный тестовый сервер.
    *) fail 'CLI_RELEASE_BASE_URL must be an HTTPS URL' ;;
esac
case "$BASE" in *'@'*|*'?'*|*'#'*|*' '*|*"'"*|*'"'*) fail 'Invalid download URL' ;; esac
if [ -z "$TARGET" ]; then
    case "$(uname -s):$(uname -m)" in
        Darwin:arm64|Darwin:aarch64) TARGET=macos-arm64 ;;
        Darwin:x86_64)
            if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ]; then TARGET=macos-arm64
            else TARGET=macos-x64; fi ;;
        Linux:*) TARGET=jvm ;;
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
        case "$1" in https://*) PROTOCOLS='=https' ;; *) PROTOCOLS='=http,https' ;; esac
        curl --proto "$PROTOCOLS" --proto-redir "$PROTOCOLS" --fail --silent --show-error --location --max-redirs 5 --retry 2 --connect-timeout 15 --max-time 300 "$1" -o "$2"
    else
        # --https-only у wget ограничивает рекурсивную загрузку, но не HTTP-редиректы.
        # Поэтому каждый переход проверяется до следующего запроса.
        URL=$1
        HOPS=0
        case "$URL" in https://*) SECURE=1 ;; *) SECURE=0 ;; esac
        while :; do
            if wget --quiet --server-response --max-redirect=0 --timeout=30 --tries=3 -O "$2" "$URL" 2>"$WORK/headers"; then
                return
            fi
            STATUS=$(awk '$1 ~ /^HTTP\// {code=$2} END {print code}' "$WORK/headers")
            case "$STATUS" in 301|302|303|307|308) ;; *) fail 'Release download failed' ;; esac
            [ "$HOPS" -lt 5 ] || fail 'Too many redirects'
            LOCATION=$(awk 'tolower($1) == "location:" {$1=""; sub(/^ */, ""); sub(/\r$/, ""); print; exit}' "$WORK/headers")
            case "$LOCATION" in
                https://*) URL=$LOCATION ;;
                http://localhost:*|http://127.0.0.1:*)
                    [ "$SECURE" = 0 ] || fail 'Unsafe release redirect'
                    URL=$LOCATION ;;
                //*) case "$URL" in https:*) URL="https:$LOCATION" ;; *) fail 'Unsafe release redirect' ;; esac ;;
                /*) ORIGIN=$(printf '%s\n' "$URL" | sed 's#^\(https\{0,1\}://[^/]*\).*#\1#'); URL="$ORIGIN$LOCATION" ;;
                *) fail 'Unsafe release redirect' ;;
            esac
            case "$URL" in https://*) SECURE=1 ;; esac
            HOPS=$((HOPS + 1))
        done
    fi
}
if [ -z "$VERSION" ]; then
    download "$BASE/releases/latest/download/release.json" "$WORK/release.json"
else
    valid_version "$VERSION" || fail 'Invalid release version'
    download "$BASE/releases/download/cli-v$VERSION/release.json" "$WORK/release.json"
fi
# Манифест выпуска имеет каноническую форму release.py. Проверяется весь документ,
# включая уникальность полей; произвольный JSON не исполняется и парсер не нужен.
MANIFEST=$(cat "$WORK/release.json")
V='(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'
H='[0-9a-f]{64}'
PATTERN='^\{"schemaVersion":1,"version":"'"$V"'","iosCliReleaseTag":"[A-Za-z0-9][A-Za-z0-9._-]*","artifacts":\{'
SEP=
for platform in macos-arm64 macos-x64 windows-x64 jvm; do
    PATTERN="$PATTERN$SEP\"$platform\":\{\"file\":\"dsbuilder-cli-$platform\.zip\",\"sha256\":\"$H\"\}"
    SEP=,
done
PATTERN="$PATTERN\}\}$"
printf '%s\n' "$MANIFEST" | LC_ALL=C grep -Eq "$PATTERN" || fail 'Invalid release manifest'
RESOLVED=$(printf '%s\n' "$MANIFEST" | sed -n 's/.*"version":"\([0-9.]*\)".*/\1/p')
[ -z "$VERSION" ] || [ "$VERSION" = "$RESOLVED" ] || fail 'Release version mismatch'
VERSION=$RESOLVED
valid_version "$VERSION" || fail 'Invalid release version'
ARCHIVE="dsbuilder-cli-$TARGET.zip"
MANIFEST_SHA=$(printf '%s\n' "$MANIFEST" | sed -n 's/.*"'"$TARGET"'":{"file":"dsbuilder-cli-'"$TARGET"'\.zip","sha256":"\([0-9a-f]*\)"}.*/\1/p')
DOWNLOAD="$BASE/releases/download/cli-v$VERSION"
download "$DOWNLOAD/SHA256SUMS" "$WORK/SHA256SUMS"
EXPECTED=$(awk -v name="$ARCHIVE" '$2 == name {print $1}' "$WORK/SHA256SUMS")
printf '%s\n' "$EXPECTED" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$' || fail 'Invalid or missing archive checksum'
[ "$EXPECTED" = "$MANIFEST_SHA" ] || fail 'Manifest SHA-256 mismatch'
download "$DOWNLOAD/$ARCHIVE" "$WORK/archive.zip"
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
sh "$PACKAGE/install.sh" ${WITHOUT_IOS:+"$WITHOUT_IOS"} ${WITHOUT_WEB:+"$WITHOUT_WEB"}
