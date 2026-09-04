#!/usr/bin/env bash
set -euo pipefail

# Параметры
BUILD_ID=""
BASE_IMAGE=""
PUBLISH_IMAGE=""
DOCKERFILE_PATH=""
PLATFORM=""
ENV_FILE=""
JOB_PARAMS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-id) BUILD_ID="$2"; shift 2 ;;
    --image) PUBLISH_IMAGE="$2"; shift 2 ;;
    --baseImage) BASE_IMAGE="$2"; shift 2 ;;
    --dockerfile) DOCKERFILE_PATH="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --job-params) JOB_PARAMS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Проверка обязательных аргументов
if [[ -z "$BUILD_ID" || -z "$PLATFORM" || -z "$JOB_PARAMS" ]]; then
  echo "Usage: $0 --build-id <id> --platform <platform> --job-params \"<args to pass into container>\" [--baseImage <imageName>] [--image <imageName>] [--dockerfile <path>] [--env-file <path>]" >&2
  exit 2
fi

BUILD_CONTEXT="scripts"

# Env file inside backend container (mounted via compose)
ENV_FILE="${ENV_FILE:-/app/.env}"

# Shared named volume settings (compose sets SHARED_VOLUME_NAME and SHARED_ROOT)
SHARED_VOLUME_NAME="${SHARED_VOLUME_NAME:-project-builder-builds}"
SHARED_ROOT="${SHARED_ROOT:-/tmp/builds}"

if [[ -z "$DOCKERFILE_PATH" ]]; then
  echo "[publish] Dockerfile not specified — skipping image build and using BASE_IMAGE=$BASE_IMAGE"
  FINAL_IMAGE="$BASE_IMAGE"
else
  echo "[publish] Building image $PUBLISH_IMAGE from $DOCKERFILE_PATH"
  docker build --no-cache \
    -t "$PUBLISH_IMAGE" \
    -f "$DOCKERFILE_PATH" \
    --platform="$PLATFORM" \
    --build-arg "BASE_IMAGE=$BASE_IMAGE" \
    "$BUILD_CONTEXT"
  FINAL_IMAGE="$PUBLISH_IMAGE"
fi

echo "[publish] Running publish container with BUILD_ID=$BUILD_ID"
# Распарсим единственный параметр --job-params в массив аргументов для контейнера
eval "set -- $JOB_PARAMS"
CMD_ARGS=("$@")

exec docker run --rm --pull=never \
  --name "$BUILD_ID" \
  --cpus="1" \
  --memory="2g" \
  -e BUILD_ID="$BUILD_ID" \
  -e DEBUG_STAY_ALIVE=true \
  --env-file "$ENV_FILE" \
  -v "$SHARED_VOLUME_NAME":"$SHARED_ROOT:rw" \
  "$FINAL_IMAGE" \
  "${CMD_ARGS[@]}"