#!/usr/bin/env bash
set -euo pipefail

# Параметры
BUILD_ID=""
ARTIFACT_NAME=""
VERSION_MAJOR=""
VERSION_MINOR=""
VERSION_PATCH=""
COMPOSE_FLAG="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-id) BUILD_ID="$2"; shift 2 ;;
    --name) ARTIFACT_NAME="$2"; shift 2 ;;
    --versionMajor) VERSION_MAJOR="$2"; shift 2 ;;
    --versionMinor) VERSION_MINOR="$2"; shift 2 ;;
    --versionPatch) VERSION_PATCH="$2"; shift 2 ;;
    --compose) COMPOSE_FLAG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Проверка обязательных аргументов
if [[ -z "$BUILD_ID" || -z "$ARTIFACT_NAME" || -z "$VERSION_MAJOR" || -z "$VERSION_MINOR" || -z "$VERSION_PATCH" ]]; then
  echo "Usage: $0 --build-id <id> --name <artifactId> --versionMajor <X> --versionMinor <Y> --versionPatch <Z> [--compose true|false]" >&2
  exit 2
fi

# Имя образа публикации и пути
PUBLISH_IMAGE="android-publish:dev"
DOCKERFILE_PATH="scripts/android_publish.Dockerfile"
BUILD_CONTEXT="scripts"

# Shared named volume settings (compose sets SHARED_VOLUME_NAME and SHARED_ROOT)
SHARED_VOLUME_NAME="${SHARED_VOLUME_NAME:-project-builder-builds}"
SHARED_ROOT="${SHARED_ROOT:-/tmp/builds}"

# Собираем publish-образ
echo "[publish] Building image $PUBLISH_IMAGE from $DOCKERFILE_PATH"
docker build --no-cache \
  -t "$PUBLISH_IMAGE" \
  -f "$DOCKERFILE_PATH" \
  --platform=linux/amd64 \
  "$BUILD_CONTEXT"


echo "[publish] Running publish container with BUILD_ID=$BUILD_ID"
exec docker run --rm --pull=never \
  --name "publish-$BUILD_ID" \
  -e BUILD_ID="$BUILD_ID" \
  -e DEBUG_STAY_ALIVE=true \
  -v "$SHARED_VOLUME_NAME":"$SHARED_ROOT:rw" \
  "$PUBLISH_IMAGE" \
  --name "$ARTIFACT_NAME" \
  --versionMajor "$VERSION_MAJOR" \
  --versionMinor "$VERSION_MINOR" \
  --versionPatch "$VERSION_PATCH" \
  --compose "$COMPOSE_FLAG"