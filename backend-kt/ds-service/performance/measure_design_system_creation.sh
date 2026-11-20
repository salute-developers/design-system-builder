#!/usr/bin/env bash
# Замер создания дизайн-системы с шаблонами на локальном стенде (./start-local.sh).
# Только локальный стек: создаёт проект и N дизайн-систем с префиксом perf-, не запускать против dev/prod.
#
#   ./measure_design_system_creation.sh [N]
#
# Печатает медиану/минимум/максимум времени ответа клиента и время 409 при занятом имени.
# Серверное время смотреть в логе backend: событие http_request, поле durationMs.
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
N="${1:-10}"
TAG="perf-$(date +%s)"

token="$(curl -fsS -X POST "$GATEWAY_URL/realms/dsbuilder/protocol/openid-connect/token" \
  --data-urlencode grant_type=password --data-urlencode client_id=dsbuilder-api \
  --data-urlencode username="${ADMIN_USERNAME:-admin@example.com}" \
  --data-urlencode password="${ADMIN_PASSWORD:-password}" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')"

project="$(curl -fsS -X POST "$GATEWAY_URL/api/projects" -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' -d "{\"name\":\"$TAG\"}" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d["project"]["id"])')"

create() {
  curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' -X POST "$GATEWAY_URL/api/projects/$project/design-systems" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$1\",\"projectName\":\"$TAG\",\"projectId\":\"$project\"}"
}

for i in $(seq 1 "$N"); do create "$TAG-$i"; done | python3 -c '
import statistics, sys
rows = [line.split() for line in sys.stdin]
codes = sorted({code for code, _ in rows})
times = sorted(float(t) for _, t in rows)
print(f"create: codes={codes} n={len(times)} min={times[0]:.2f}s median={statistics.median(times):.2f}s max={times[-1]:.2f}s")
'
create "$TAG-1" | awk '{ printf "taken name: code=%s time=%.2fs\n", $1, $2 }'
