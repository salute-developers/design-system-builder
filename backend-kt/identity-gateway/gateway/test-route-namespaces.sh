#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

for config in nginx.local.conf nginx.prod.conf.template; do
  ds_block=$(awk 'index($0, "location ~ ^/api/projects/([^/]+)/ds(/.*)?$ {") { found=1 } found { print } found && /^        }/ { exit }' "$config")
  compatibility_block=$(awk 'index($0, "location ~ ^/api/projects/([^/]+)/ds/legacy(/.*)?$ {") { found=1 } found { print } found && /^        }/ { exit }' "$config")
  documentation_block=$(awk 'index($0, "location ~ ^/api/projects/([^/]+)/documentation(/.*)?$ {") { found=1 } found { print } found && /^        }/ { exit }' "$config")

  test -n "$ds_block"
  test -n "$compatibility_block"
  test -n "$documentation_block"

  printf '%s' "$ds_block" | grep -Fq 'set $project_id $1;'
  printf '%s' "$ds_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$ds_block" | grep -Fq 'auth_request_set $trusted_project_id $upstream_http_x_project_id;'
  printf '%s' "$ds_block" | grep -Fq 'proxy_set_header X-Project-Id $trusted_project_id;'
  printf '%s' "$ds_block" | grep -Fq 'rewrite ^/api/projects/[^/]+/ds(/.*)?$ /api/ds$1 break;'
  printf '%s' "$ds_block" | grep -Fq 'ds_service_api'
  printf '%s' "$compatibility_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$compatibility_block" | grep -Fq 'proxy_set_header X-Project-Id $trusted_project_id;'
  printf '%s' "$compatibility_block" | grep -Fq 'db_service_api'

  # Сервис documentation-generator удалён: маршрута /docs и его upstream нет.
  # `! grep` под `set -e` скрипт не останавливает, поэтому выход явный.
  if grep -Fq 'location ~ ^/api/projects/([^/]+)/docs(/.*)?$' "$config"; then
    echo "$config: the /docs route of the removed documentation-generator must not exist" >&2
    exit 1
  fi
  if grep -Fq 'docs_service_api' "$config"; then
    echo "$config: the docs_service_api upstream must not exist" >&2
    exit 1
  fi

  printf '%s' "$documentation_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$documentation_block" | grep -Fq 'auth_request_set $trusted_project_id'
  printf '%s' "$documentation_block" | grep -Fq 'proxy_set_header X-Project-Id $trusted_project_id;'
  printf '%s' "$documentation_block" | grep -Fq 'rewrite ^/api/projects/[^/]+/documentation(/.*)?$ /documentation$1 break;'
  printf '%s' "$documentation_block" | grep -Fq 'documentation_service_api'
  if [ "$config" = "nginx.prod.conf.template" ]; then
    printf '%s' "$documentation_block" | grep -Fq 'limit_req zone=project_api burst=20 nodelay;'
  fi

  import_meta_block=$(awk 'index($0, "location = /api/admin/component-config/import-api-meta {") { found=1 } found { print } found && /^        }/ { exit }' "$config")

  test -n "$import_meta_block"

  # Импорт API-меты живёт в ds-service: только токен пользователя, служебный проект `global`,
  # роль системного администратора проверяет сам сервис.
  printf '%s' "$import_meta_block" | grep -Fq 'auth_request /_auth_user;'
  ! printf '%s' "$import_meta_block" | grep -Fq 'auth_request /_auth_project;'
  printf '%s' "$import_meta_block" | grep -Fq 'client_max_body_size 16m;'
  printf '%s' "$import_meta_block" | grep -Fq 'proxy_set_header X-Project-Id "global";'
  printf '%s' "$import_meta_block" | grep -Fq 'proxy_set_header X-System-Admin $trusted_system_admin;'
  printf '%s' "$import_meta_block" | grep -Fq 'rewrite ^/api/admin/component-config/import-api-meta$ /api/ds/admin/component-config/import-api-meta break;'
  printf '%s' "$import_meta_block" | grep -Fq 'ds_service_api'
  ! printf '%s' "$import_meta_block" | grep -Fq 'db_service_api'

  # Админка удалена вместе с маршрутами /api/admin/* db-service: общего блока /api/admin больше нет,
  # остаётся только точный маршрут импорта API-меты в ds-service.
  if grep -Fq 'location ~ ^/api/admin(/.*)?$' "$config"; then
    echo "$config: the /api/admin block of the removed admin routes must not exist" >&2
    exit 1
  fi

  ! grep -Fq 'location /documentation' "$config"
  ! grep -Fq 'location = /documentation' "$config"
  ! grep -Fq 'location ~ ^/documentation' "$config"
  ! grep -Fq 'location ~ ^/api/documentation' "$config"
done
