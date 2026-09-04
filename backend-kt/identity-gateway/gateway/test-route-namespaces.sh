#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

for config in nginx.local.conf nginx.prod.conf.template; do
  docs_block=$(awk 'index($0, "location ~ ^/api/projects/([^/]+)/docs(/.*)?$ {") { found=1 } found { print } found && /^        }/ { exit }' "$config")
  documentation_block=$(awk 'index($0, "location ~ ^/api/projects/([^/]+)/documentation(/.*)?$ {") { found=1 } found { print } found && /^        }/ { exit }' "$config")

  test -n "$docs_block"
  test -n "$documentation_block"

  printf '%s' "$docs_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$docs_block" | grep -Fq 'proxy_pass '
  printf '%s' "$docs_block" | grep -Fq 'docs_service_api'
  printf '%s' "$docs_block" | grep -Fq 'rewrite ^/api/projects/[^/]+/docs'

  printf '%s' "$documentation_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$documentation_block" | grep -Fq 'auth_request_set $trusted_project_id'
  printf '%s' "$documentation_block" | grep -Fq 'proxy_set_header X-Project-Id $trusted_project_id;'
  printf '%s' "$documentation_block" | grep -Fq 'rewrite ^/api/projects/[^/]+/documentation(/.*)?$ /documentation$1 break;'
  printf '%s' "$documentation_block" | grep -Fq 'documentation_service_api'
  if [ "$config" = "nginx.prod.conf.template" ]; then
    printf '%s' "$documentation_block" | grep -Fq 'limit_req zone=project_api burst=20 nodelay;'
  fi

  ! grep -Fq 'location /documentation' "$config"
  ! grep -Fq 'location = /documentation' "$config"
  ! grep -Fq 'location ~ ^/documentation' "$config"
  ! grep -Fq 'location ~ ^/api/documentation' "$config"
done
