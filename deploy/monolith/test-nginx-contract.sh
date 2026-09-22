#!/usr/bin/env bash
set -Eeuo pipefail

template="${1:-deploy/monolith/nginx.conf.template}"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

export OIDC_WEB_ORIGIN='https://app.example.test'
export KEYCLOAK_UPSTREAM_SCHEME='https'
export KEYCLOAK_UPSTREAM_HOST='127.0.0.1'
export KEYCLOAK_UPSTREAM_PORT='8443'
export KEYCLOAK_REALM='contract-realm'
export GATEWAY_PROXY_TIMEOUT_SECONDS='321'
export DOCUMENTATION_MAX_REQUEST_SIZE='123m'

envsubst '${OIDC_WEB_ORIGIN} ${KEYCLOAK_UPSTREAM_SCHEME} ${KEYCLOAK_UPSTREAM_HOST} ${KEYCLOAK_UPSTREAM_PORT} ${KEYCLOAK_REALM} ${GATEWAY_PROXY_TIMEOUT_SECONDS} ${DOCUMENTATION_MAX_REQUEST_SIZE}' \
  < "$template" > "$rendered"

node - "$rendered" <<'NODE'
const fs = require('fs');
const config = fs.readFileSync(process.argv[2], 'utf8');

function fail(message) {
  console.error(`nginx contract failed: ${message}`);
  process.exit(1);
}

function requireText(text, scope = config, description = text) {
  if (!scope.includes(text)) fail(`missing ${description}`);
}

function forbidText(text, scope = config, description = text) {
  if (scope.includes(text)) fail(`unexpected ${description}`);
}

function block(marker) {
  const start = config.indexOf(marker);
  if (start < 0) fail(`missing block ${marker}`);
  const open = config.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < config.length; index += 1) {
    if (config[index] === '{') depth += 1;
    if (config[index] === '}') depth -= 1;
    if (depth === 0) return config.slice(start, index + 1);
  }
  fail(`unterminated block ${marker}`);
}

function requireTrustedHeaderClearing(scope, name) {
  for (const header of [
    'X-Actor-Type',
    'X-User-Id',
    'X-Project-Id',
    'X-Project-Role',
    'X-Project-Key-Id',
    'X-Project-Scopes',
    'X-System-Admin',
  ]) {
    requireText(`proxy_set_header ${header} "";`, scope, `${name} clears ${header}`);
  }
}

function requireKeycloakProxy(marker, endpoint) {
  const scope = block(marker);
  requireText('limit_req zone=project_api burst=20 nodelay;', scope, `${marker} rate limit`);
  requireTrustedHeaderClearing(scope, marker);
  requireText('proxy_set_header Host $http_host;', scope, `${marker} Host forwarding`);
  requireText('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;', scope, `${marker} X-Forwarded-For`);
  requireText('proxy_set_header X-Forwarded-Host $forwarded_host;', scope, `${marker} X-Forwarded-Host`);
  requireText('proxy_set_header X-Forwarded-Port $forwarded_port;', scope, `${marker} X-Forwarded-Port`);
  requireText('proxy_set_header X-Forwarded-Proto $forwarded_proto;', scope, `${marker} X-Forwarded-Proto`);
  requireText('proxy_ssl_server_name on;', scope, `${marker} TLS SNI enablement`);
  requireText('proxy_ssl_name 127.0.0.1;', scope, `${marker} TLS SNI name`);
  requireText(`proxy_pass ${endpoint};`, scope, `${marker} upstream mapping`);
}

forbidText('${', config, 'unrendered environment placeholder');
forbidText('auth-helper:8091');
forbidText('projects-service:8082');
forbidText('documentation-service:8084');
requireText('server 127.0.0.1:8081;');
requireText('server 127.0.0.1:3008;');

requireText('proxy_hide_header Access-Control-Allow-Origin;');
requireText('proxy_hide_header Access-Control-Allow-Methods;');
requireText('proxy_hide_header Access-Control-Allow-Headers;');
requireText('"https://app.example.test" $http_origin;', config, 'rendered CORS origin');

requireText('return 404;', block('location = /auth/login'), '/auth/login remains disabled');
requireText('return 404;', block('location = /auth/register'), '/auth/register remains disabled');
requireText('return 302 /realms/contract-realm/account/;', block('location = /auth/account'), '/auth/account mapping');
requireKeycloakProxy(
  'location = /auth/token',
  'https://keycloak/realms/contract-realm/protocol/openid-connect/token',
);
requireKeycloakProxy(
  'location = /auth/logout',
  'https://keycloak/realms/contract-realm/protocol/openid-connect/logout',
);
requireKeycloakProxy('location /auth/', 'https://keycloak/');
requireKeycloakProxy('location /realms/', 'https://keycloak');
requireKeycloakProxy('location /resources/', 'https://keycloak');

for (const marker of [
  'location = /admin',
  'location ^~ /admin/',
  'location = /api/admin',
  'location ^~ /api/admin/',
]) {
  requireText('return 404;', block(marker), `${marker} is blocked`);
}

requireText('return 308 /api/projects;', block('location = /api/projects/'), 'projects slash redirect');
requireTrustedHeaderClearing(block('location = /_auth_user'), '/_auth_user');
requireTrustedHeaderClearing(block('location = /_auth_project'), '/_auth_project');

const documentation = block('location ~ ^/api/projects/([^/]+)/documentation');
for (const contract of [
  'client_max_body_size 123m;',
  'proxy_request_buffering off;',
  'proxy_buffering off;',
  'proxy_connect_timeout 10s;',
  'proxy_send_timeout 321s;',
  'proxy_read_timeout 321s;',
  'proxy_set_header X-Request-Id $request_id;',
  'proxy_set_header Host $host;',
  'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  'proxy_set_header X-Forwarded-Proto $scheme;',
]) {
  requireText(contract, documentation, `Documentation ${contract}`);
}
NODE

if command -v nginx >/dev/null 2>&1; then
  nginx -t -c "$rendered"
fi

echo "Rendered nginx contract passed: $template"
