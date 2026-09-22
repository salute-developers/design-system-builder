#!/usr/bin/env bash
set -Eeuo pipefail

project_name="dsbuilder-monolith"
compose_file="docker-compose.monolith.yml"
env_file="${MONOLITH_ENV_FILE:-.env.monolith}"
detach=0
no_build=0
action=start

usage() {
  echo "Usage: $0 [--detach] [--no-build] [--down|--logs]" >&2
}

while (($# > 0)); do
  case "$1" in
    --detach) detach=1 ;;
    --no-build) no_build=1 ;;
    --down) action=down ;;
    --logs) action=logs ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
  shift
done

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required" >&2; exit 1; }

compose=(docker compose --project-name "$project_name" --env-file "$env_file" -f "$compose_file")

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file; copy .env.monolith.example and review its local credentials." >&2
  exit 1
fi

case "$action" in
  down)
    "${compose[@]}" down
    exit 0
    ;;
  logs)
    "${compose[@]}" logs --follow backend-monolith
    exit 0
    ;;
esac

up_args=(up)
((no_build == 0)) && up_args+=(--build)
((detach == 1)) && up_args+=(--detach)
up_args+=(backend-monolith)
"${compose[@]}" "${up_args[@]}"

if ((detach == 0)); then
  exit 0
fi

configured_public_port="$(sed -n 's/^MONOLITH_PUBLIC_PORT=//p' "$env_file" | tail -1)"
public_port="${MONOLITH_PUBLIC_PORT:-${configured_public_port:-8080}}"
configured_timeout="$(sed -n 's/^MONOLITH_STARTUP_TIMEOUT_SECONDS=//p' "$env_file" | tail -1)"
timeout="${MONOLITH_STARTUP_TIMEOUT_SECONDS:-${configured_timeout:-180}}"
deadline=$((SECONDS + timeout))

until curl --fail --silent "http://127.0.0.1:${public_port}/health/ready" >/dev/null; do
  if ((SECONDS >= deadline)); then
    echo "Monolith did not become ready within ${timeout}s." >&2
    "${compose[@]}" ps >&2
    "${compose[@]}" logs --tail=200 backend-monolith >&2
    exit 1
  fi
  if [[ "$("${compose[@]}" ps --status exited --quiet backend-monolith)" != "" ]]; then
    echo "Monolith exited during startup." >&2
    "${compose[@]}" logs --tail=200 backend-monolith >&2
    exit 1
  fi
  sleep 2
done

echo "Monolith is ready at http://127.0.0.1:${public_port}"
