#!/usr/bin/env bash
set -Eeuo pipefail

grep -Fq 'EXPOSE 8080' Dockerfile.monolith
if grep -Eq 'EXPOSE (8081|3008)' Dockerfile.monolith; then
  echo "Internal ports must not be exposed" >&2
  exit 1
fi

grep -Fq 'wait -n' deploy/monolith/entrypoint.sh
grep -Fq 'kill -TERM' deploy/monolith/entrypoint.sh
grep -Fq 'kill -KILL' deploy/monolith/entrypoint.sh
grep -Fq 'exit 1' deploy/monolith/entrypoint.sh

config="$(docker compose --env-file .env.monolith.example -f docker-compose.monolith.yml config)"
grep -Fq 'target: 8080' <<<"$config"
if grep -Eq 'published: "?(8081|3008)"?' <<<"$config"; then
  echo "Compose published an internal port" >&2
  exit 1
fi

if grep -Eq '^  (project-publisher|generator|publisher|documentation-generator):' <<<"$config"; then
  echo "Deprecated runtime leaked into monolith Compose" >&2
  exit 1
fi
