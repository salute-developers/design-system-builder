#!/usr/bin/env bash
set -euo pipefail

# Параметры
BUILD_ID=""
ARTIFACT_NAME=""
VERSION_MAJOR=""
VERSION_MINOR=""
VERSION_PATCH=""
BASE_IMAGE=""
PUBLISH_IMAGE=""
DOCKERFILE_PATH=""
PLATFORM=""
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-id) BUILD_ID="$2"; shift 2 ;;
    --name) ARTIFACT_NAME="$2"; shift 2 ;;
    --versionMajor) VERSION_MAJOR="$2"; shift 2 ;;
    --versionMinor) VERSION_MINOR="$2"; shift 2 ;;
    --versionPatch) VERSION_PATCH="$2"; shift 2 ;;
    --image) PUBLISH_IMAGE="$2"; shift 2 ;;
    --baseImage) BASE_IMAGE="$2"; shift 2 ;;
    --dockerfile) DOCKERFILE_PATH="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Проверка обязательных аргументов
if [[ -z "$BUILD_ID" || -z "$ARTIFACT_NAME" || -z "$VERSION_MAJOR" || -z "$VERSION_MINOR" || -z "$VERSION_PATCH" || -z "$PUBLISH_IMAGE" || -z "$DOCKERFILE_PATH" || -z "$PLATFORM" ]]; then
  echo "Usage: $0 --build-id <id> --name <artifactId> --versionMajor <X> --versionMinor <Y> --versionPatch <Z> --image <imageName> --baseImage <imageName> --dockerfile <path> --platform <platform>" >&2
  exit 2
fi

BUILD_CONTEXT="scripts"

# Env file inside backend container (mounted via compose)
ENV_FILE="${ENV_FILE:-/app/.env}"

# Shared named volume settings (compose sets SHARED_VOLUME_NAME and SHARED_ROOT)
SHARED_VOLUME_NAME="${SHARED_VOLUME_NAME:-project-builder-builds}"
SHARED_ROOT="${SHARED_ROOT:-/tmp/builds}"

# Собираем publish-образ
echo "[publish] Building image $PUBLISH_IMAGE from $DOCKERFILE_PATH"
docker build --no-cache \
  -t "$PUBLISH_IMAGE" \
  -f "$DOCKERFILE_PATH" \
  --platform="$PLATFORM" \
  --build-arg "BASE_IMAGE=$BASE_IMAGE" \
  "$BUILD_CONTEXT"


echo "[publish] Running publish container with BUILD_ID=$BUILD_ID"
exec docker run --rm --pull=never \
  --name "$BUILD_ID" \
  --cpus="2" \
  --memory="4g" \
  -e BUILD_ID="$BUILD_ID" \
  -e DEBUG_STAY_ALIVE=true \
  --env-file "$ENV_FILE" \
  -v "$SHARED_VOLUME_NAME":"$SHARED_ROOT:rw" \
  "$PUBLISH_IMAGE" \
  --name "$ARTIFACT_NAME" \
  --versionMajor "$VERSION_MAJOR" \
  --versionMinor "$VERSION_MINOR" \
  --versionPatch "$VERSION_PATCH"