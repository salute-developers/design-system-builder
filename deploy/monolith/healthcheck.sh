#!/usr/bin/env sh
set -eu

curl --fail --silent --show-error --max-time 4 http://127.0.0.1:8080/health >/dev/null
curl --fail --silent --show-error --max-time 4 http://127.0.0.1:8081/health/live >/dev/null
curl --fail --silent --show-error --max-time 4 http://127.0.0.1:8081/health/ready >/dev/null
curl --fail --silent --show-error --max-time 4 http://127.0.0.1:3008/api/health >/dev/null
