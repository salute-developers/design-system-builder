#!/usr/bin/env sh
set -eu

keycloak_url="${KEYCLOAK_BOOTSTRAP_URL:-http://keycloak:8080}"
realm="${KEYCLOAK_REALM:?KEYCLOAK_REALM is required}"
oidc_client_id="${OIDC_CLIENT_ID:?OIDC_CLIENT_ID is required}"
oidc_redirect_uri="${OIDC_REDIRECT_URI:?OIDC_REDIRECT_URI is required}"
oidc_web_origin="${OIDC_WEB_ORIGIN:?OIDC_WEB_ORIGIN is required}"
projects_client_id="${PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID:?PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID is required}"
projects_client_secret="${PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET:?PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET is required}"

extract_first_id() {
  sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

/opt/keycloak/bin/kcadm.sh config credentials \
  --server "$keycloak_url" \
  --realm master \
  --user "${KEYCLOAK_ADMIN:?KEYCLOAK_ADMIN is required}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD is required}"

/opt/keycloak/bin/kcadm.sh update "realms/$realm" \
  -s "registrationAllowed=false" \
  -s "registrationEmailAsUsername=false" \
  -s "verifyEmail=false" \
  -s "loginWithEmailAllowed=false" \
  -s "resetPasswordAllowed=false"

user_profile_config="/tmp/dsbuilder-user-profile.json"
cat >"$user_profile_config" <<'JSON'
{
  "attributes": [
    {
      "name": "username",
      "displayName": "${username}",
      "validations": {
        "length": {
          "min": 3,
          "max": 255
        },
        "username-prohibited-characters": {},
        "up-username-not-idn-homograph": {}
      },
      "permissions": {
        "view": [
          "admin",
          "user"
        ],
        "edit": [
          "admin"
        ]
      },
      "multivalued": false
    },
    {
      "name": "email",
      "displayName": "${email}",
      "validations": {
        "email": {},
        "length": {
          "max": 255
        }
      },
      "permissions": {
        "view": [
          "admin",
          "user"
        ],
        "edit": [
          "admin"
        ]
      },
      "multivalued": false
    },
    {
      "name": "firstName",
      "displayName": "${firstName}",
      "validations": {
        "length": {
          "max": 255
        },
        "person-name-prohibited-characters": {}
      },
      "permissions": {
        "view": [
          "admin",
          "user"
        ],
        "edit": [
          "admin"
        ]
      },
      "multivalued": false
    },
    {
      "name": "lastName",
      "displayName": "${lastName}",
      "validations": {
        "length": {
          "max": 255
        },
        "person-name-prohibited-characters": {}
      },
      "permissions": {
        "view": [
          "admin",
          "user"
        ],
        "edit": [
          "admin"
        ]
      },
      "multivalued": false
    }
  ],
  "groups": [
    {
      "name": "user-metadata",
      "displayHeader": "User metadata",
      "displayDescription": "Attributes, which refer to user metadata"
    }
  ],
  "unmanagedAttributePolicy": "ENABLED"
}
JSON

/opt/keycloak/bin/kcadm.sh update users/profile -r "$realm" -f "$user_profile_config"

public_client_id="$(
  /opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q "clientId=$oidc_client_id" | extract_first_id
)"

if [ -z "$public_client_id" ]; then
  /opt/keycloak/bin/kcadm.sh create clients -r "$realm" \
    -s "clientId=$oidc_client_id" \
    -s "enabled=true" \
    -s "publicClient=true" \
    -s "directAccessGrantsEnabled=true" \
    -s "standardFlowEnabled=true" \
    -s "redirectUris=[\"$oidc_redirect_uri\"]" \
    -s "webOrigins=[\"$oidc_web_origin\"]" \
    -s "protocol=openid-connect"

  public_client_id="$(
    /opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q "clientId=$oidc_client_id" | extract_first_id
  )"
else
  /opt/keycloak/bin/kcadm.sh update "clients/$public_client_id" -r "$realm" \
    -s "clientId=$oidc_client_id" \
    -s "enabled=true" \
    -s "publicClient=true" \
    -s "directAccessGrantsEnabled=true" \
    -s "standardFlowEnabled=true" \
    -s "redirectUris=[\"$oidc_redirect_uri\"]" \
    -s "webOrigins=[\"$oidc_web_origin\"]" \
    -s "protocol=openid-connect"
fi

if ! /opt/keycloak/bin/kcadm.sh get "clients/$public_client_id/protocol-mappers/models" -r "$realm" | grep -q '"name" : "dsbuilder-api-audience"'; then
  /opt/keycloak/bin/kcadm.sh create "clients/$public_client_id/protocol-mappers/models" -r "$realm" \
    -s "name=dsbuilder-api-audience" \
    -s "protocol=openid-connect" \
    -s "protocolMapper=oidc-audience-mapper" \
    -s "config.\"included.client.audience\"=$oidc_client_id" \
    -s 'config."access.token.claim"=true'
fi

projects_client_uuid="$(
  /opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q "clientId=$projects_client_id" | extract_first_id
)"

if [ -z "$projects_client_uuid" ]; then
  /opt/keycloak/bin/kcadm.sh create clients -r "$realm" \
    -s "clientId=$projects_client_id" \
    -s "name=Projects Service Lookup" \
    -s "enabled=true" \
    -s "protocol=openid-connect" \
    -s "publicClient=false" \
    -s "clientAuthenticatorType=client-secret" \
    -s "secret=$projects_client_secret" \
    -s "standardFlowEnabled=false" \
    -s "directAccessGrantsEnabled=false" \
    -s "serviceAccountsEnabled=true"

  projects_client_uuid="$(
    /opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q "clientId=$projects_client_id" | extract_first_id
  )"
else
  /opt/keycloak/bin/kcadm.sh update "clients/$projects_client_uuid" -r "$realm" \
    -s "clientId=$projects_client_id" \
    -s "name=Projects Service Lookup" \
    -s "enabled=true" \
    -s "protocol=openid-connect" \
    -s "publicClient=false" \
    -s "clientAuthenticatorType=client-secret" \
    -s "secret=$projects_client_secret" \
    -s "standardFlowEnabled=false" \
    -s "directAccessGrantsEnabled=false" \
    -s "serviceAccountsEnabled=true"
fi

service_account_username="service-account-$projects_client_id"
/opt/keycloak/bin/kcadm.sh add-roles \
  -r "$realm" \
  --uusername "$service_account_username" \
  --cclientid realm-management \
  --rolename query-users \
  --rolename view-users || true

echo "Keycloak production bootstrap completed"
