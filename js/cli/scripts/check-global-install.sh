#!/bin/sh
# Проверка опубликованного вида генератора: `npm pack`, глобальная установка архива в отдельный prefix
# (как `npm install -g`) и генерация из постороннего каталога без репозитория и без js/.env.
# С `.sdds` в аргументе генерирует дизайн-систему целиком, иначе тему из встроенных минимальных данных.
set -eu

CLI_DIR=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
SDDS=${1:-}
WORK=$(mktemp -d "${TMPDIR:-/tmp}/dsbuilder-web-check.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

npm pack --silent --pack-destination "$WORK" "$CLI_DIR" > "$WORK/archive-name"
ARCHIVE="$WORK/$(cat "$WORK/archive-name")"
npm install -g --silent --no-audit --no-fund --prefix "$WORK/prefix" "$ARCHIVE"
GENERATOR="$WORK/prefix/bin/dsbuilder-web-generator"
[ -x "$GENERATOR" ] || { echo "dsbuilder-web-generator is not installed into $WORK/prefix/bin" >&2; exit 1; }
printf 'Installed %s %s\n' "$(basename "$ARCHIVE")" "$("$GENERATOR" --version)"

PROJECT="$WORK/project"
mkdir -p "$PROJECT"
if [ -n "$SDDS" ]; then
    cp -R "$SDDS" "$PROJECT/.sdds"
    COMMAND=ds
else
    TENANT="$PROJECT/.sdds/tenants/brand"
    mkdir -p "$TENANT/web"
    printf '%s' '{"gray":{"1000":"#000000"}}' > "$PROJECT/.sdds/tenants/palette.json"
    printf '%s' '{"name":"brand","version":"latest","tokens":[{"type":"color","name":"dark.text.default.primary","tags":["dark","text","default","primary"],"displayName":"textPrimary","description":"","enabled":true}]}' > "$TENANT/meta.json"
    printf '%s' '{"dark.text.default.primary":"#FFFFFFFF"}' > "$TENANT/web/web_color.json"
    for kind in gradient shape spacing shadow typography fontFamily; do printf '{}' > "$TENANT/web/web_$kind.json"; done
    COMMAND=theme
fi

(cd "$PROJECT" && env -u NPM_PACKAGE_SCOPE "$GENERATOR" "$COMMAND" --package --name base)
NAME=$(node -p "require('$PROJECT/output/package.json').name")
[ "$NAME" = "@sddsjs/base" ] || { echo "Unexpected package name: $NAME" >&2; exit 1; }
for file in .gitignore .npmignore .npmrc tsconfig.json; do
    [ -f "$PROJECT/output/$file" ] || { echo "Generated package has no $file" >&2; exit 1; }
done
printf 'Generated %s with dsbuilder-web-generator %s\n' "$NAME" "$COMMAND"
