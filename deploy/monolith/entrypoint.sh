#!/usr/bin/env bash
set -Eeuo pipefail

shutdown_timeout="${MONOLITH_SHUTDOWN_TIMEOUT_SECONDS:-10}"
stopping=0
pids=()

shutdown() {
  stopping=1
  if ((${#pids[@]} > 0)); then
    kill -TERM "${pids[@]}" 2>/dev/null || true
    local deadline=$((SECONDS + shutdown_timeout))
    while ((SECONDS < deadline)); do
      local alive=0
      for pid in "${pids[@]}"; do
        kill -0 "$pid" 2>/dev/null && alive=1
      done
      ((alive == 0)) && return
      sleep 1
    done
    kill -KILL "${pids[@]}" 2>/dev/null || true
  fi
}

trap shutdown TERM INT

envsubst '${OIDC_WEB_ORIGIN} ${KEYCLOAK_UPSTREAM_SCHEME} ${KEYCLOAK_UPSTREAM_HOST} ${KEYCLOAK_UPSTREAM_PORT} ${KEYCLOAK_REALM} ${GATEWAY_PROXY_TIMEOUT_SECONDS} ${DOCUMENTATION_MAX_REQUEST_SIZE}' \
  < /etc/nginx/templates/monolith.conf.template > /tmp/nginx.conf

nginx -c /tmp/nginx.conf -g 'daemon off;' & pids+=("$!")
java ${JAVA_OPTS:-} -jar /opt/monolith/backend-monolith.jar & pids+=("$!")
node /opt/monolith/db-service/dist/index.js & pids+=("$!")

set +e
wait -n "${pids[@]}"
child_status=$?
set -e

if ((stopping == 0)); then
  echo "Required monolith process exited unexpectedly with status ${child_status}" >&2
  shutdown
  wait "${pids[@]}" 2>/dev/null || true
  exit 1
fi

wait "${pids[@]}" 2>/dev/null || true
exit 0
