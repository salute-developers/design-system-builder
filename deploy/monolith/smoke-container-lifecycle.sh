#!/usr/bin/env bash
set -Eeuo pipefail

compose=(
  docker compose
  --project-name "${MONOLITH_COMPOSE_PROJECT:-dsbuilder-monolith}"
  --env-file "${MONOLITH_ENV_FILE:-.env.monolith}"
  -f docker-compose.monolith.yml
)
service=backend-monolith

child_pid() {
  local container="$1"
  local pattern="$2"
  docker exec "$container" sh -c '
    pattern="$1"
    for command_file in /proc/[0-9]*/cmdline; do
      pid="${command_file#/proc/}"
      pid="${pid%/cmdline}"
      [ "$pid" = "$$" ] && continue
      command="$(tr "\000" " " <"$command_file" 2>/dev/null || true)"
      case "$command" in
        *"$pattern"*) printf "%s\n" "$pid"; exit 0 ;;
      esac
    done
    exit 1
  ' sh "$pattern"
}

assert_container_fails_after() {
  local pattern="$1"
  local container pid
  container="$("${compose[@]}" ps --quiet "$service")"
  pid="$(child_pid "$container" "$pattern")"
  docker exec "$container" sh -c 'kill -TERM "$1"' sh "$pid"
  for _ in {1..30}; do
    [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == false ]] && break
    sleep 1
  done
  [[ "$(docker inspect --format '{{.State.ExitCode}}' "$container")" != 0 ]]
}

case "${1:-}" in
  nginx) assert_container_fails_after 'nginx: master' ;;
  kotlin) assert_container_fails_after 'backend-monolith.jar' ;;
  node) assert_container_fails_after 'dist/index.js' ;;
  sigterm)
    container="$("${compose[@]}" ps --quiet "$service")"
    docker stop --time 15 "$container"
    [[ "$(docker inspect --format '{{.State.ExitCode}}' "$container")" == 0 ]]
    ;;
  health)
    container="$("${compose[@]}" ps --quiet "$service")"
    pid="$(child_pid "$container" backend-monolith.jar)"
    docker exec "$container" sh -c 'kill -STOP "$1"' sh "$pid"
    ! docker exec "$container" /usr/local/bin/healthcheck.sh
    docker exec "$container" sh -c 'kill -CONT "$1"' sh "$pid"
    ;;
  *) echo "Usage: $0 nginx|kotlin|node|sigterm|health" >&2; exit 2 ;;
esac
