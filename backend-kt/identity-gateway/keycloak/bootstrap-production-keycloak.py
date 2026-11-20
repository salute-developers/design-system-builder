"""Настройка production realm одним процессом через Keycloak Admin REST API."""

import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class BootstrapError(RuntimeError):
    """Безопасная для журнала ошибка без тела ответа, токенов и секретов."""


class AdminApi:
    """Одна административная сессия; истёкший access token обновляется при 401."""

    def __init__(self, env):
        self.url = env.get("KEYCLOAK_BOOTSTRAP_URL", "http://keycloak:8080").rstrip("/")
        self.credentials = {
            "client_id": "admin-cli",
            "grant_type": "password",
            "username": env["KEYCLOAK_ADMIN"],
            "password": env["KEYCLOAK_ADMIN_PASSWORD"],
        }
        self.token = None
        self.realm = "/admin/realms/" + quote(env["KEYCLOAK_REALM"], safe="")

    def login(self):
        self.token = None
        request = Request(
            self.url + "/realms/master/protocol/openid-connect/token",
            data=urlencode(self.credentials).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            self.token = json.load(response)["access_token"]

    def call(self, method, path="", body=None, missing_ok=False, refresh=True):
        request = Request(
            self.url + self.realm + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
            method=method,
        )
        try:
            with urlopen(request, timeout=10) as response:
                payload = response.read()
                return json.loads(payload) if payload else None
        except HTTPError as failure:
            status = failure.code
            failure.close()
            if status == 404 and missing_ok:
                return None
            if status == 401 and refresh:
                self.login()
                return self.call(method, path, body, missing_ok, refresh=False)
            raise BootstrapError(f"Keycloak Admin API {method} failed (HTTP {status})") from None

    def find_client(self, client_id):
        clients = self.call("GET", "/clients?" + urlencode({"clientId": client_id}))
        matches = [client for client in clients if client["clientId"] == client_id]
        if len(matches) > 1:
            raise BootstrapError("Keycloak returned duplicate client IDs")
        return matches[0] if matches else None

    def upsert_client(self, settings):
        existing = self.find_client(settings["clientId"])
        if existing is None:
            self.call("POST", "/clients", settings)
            existing = self.find_client(settings["clientId"])
            if existing is None:
                raise BootstrapError("Created Keycloak client was not found")
        else:
            # Сохраняем сторонние attributes, включая настройки других клиентов CLI.
            if "attributes" in settings:
                settings = dict(settings, attributes={
                    **existing.get("attributes", {}), **settings["attributes"],
                })
            self.call("PUT", "/clients/" + quote(existing["id"], safe=""), settings)
        return quote(existing["id"], safe="")

    def audience(self, client_id, audience):
        path = f"/clients/{client_id}/protocol-mappers/models"
        existing = self.call("GET", path)
        if any(mapper["name"] == "dsbuilder-api-audience" for mapper in existing):
            return
        self.call("POST", path, {
            "name": "dsbuilder-api-audience", "protocol": "openid-connect",
            "protocolMapper": "oidc-audience-mapper",
            "config": {"included.client.audience": audience, "access.token.claim": "true"},
        })

    def grant_roles(self, client_id, role_names, role_client=None):
        user = self.call("GET", f"/clients/{client_id}/service-account-user")
        user_id = quote(user["id"], safe="")
        if role_client is None:
            roles = [self.call("GET", "/roles/" + quote(name, safe="")) for name in role_names]
            path = f"/users/{user_id}/role-mappings/realm"
        else:
            owner = self.find_client(role_client)
            if owner is None:
                raise BootstrapError("Required role-owning client was not found")
            owner_id = quote(owner["id"], safe="")
            roles = [self.call("GET", f"/clients/{owner_id}/roles/" + quote(name, safe=""))
                     for name in role_names]
            path = f"/users/{user_id}/role-mappings/clients/{owner_id}"
        # Keycloak не дублирует уже назначенные роли. Ошибки не скрываются как успешный bootstrap.
        self.call("POST", path, roles)


def service_client(client_id, name, secret):
    """Конфигурация доверенного клиента с service account без интерактивного входа."""
    return {
        "clientId": client_id, "name": name, "enabled": True, "protocol": "openid-connect",
        "publicClient": False, "clientAuthenticatorType": "client-secret", "secret": secret,
        "standardFlowEnabled": False, "directAccessGrantsEnabled": False, "serviceAccountsEnabled": True,
    }


def bootstrap(env, sleep=time.sleep):
    """Ожидает Admin API, затем применяет ту же конфигурацию к новым и существующим клиентам."""
    required = (
        "KEYCLOAK_REALM", "OIDC_CLIENT_ID", "OIDC_REDIRECT_URI", "OIDC_WEB_ORIGIN",
        "PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID", "PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET",
        "KEYCLOAK_ADMIN", "KEYCLOAK_ADMIN_PASSWORD",
    )
    for name in required:
        if not env.get(name):
            raise BootstrapError(f"{name} is required")
    api = AdminApi(env)
    for attempt in range(1, 31):
        try:
            if api.token is None:
                api.login()
            api.call("PUT", "", {
                "registrationAllowed": False, "registrationEmailAsUsername": False,
                "verifyEmail": False, "loginWithEmailAllowed": False, "resetPasswordAllowed": False,
                "offlineSessionIdleTimeout": 2592000, "offlineSessionMaxLifespanEnabled": True,
                "offlineSessionMaxLifespan": 7776000,
            })
            break
        except (HTTPError, URLError, TimeoutError, BootstrapError):
            if attempt == 30:
                raise BootstrapError("Keycloak Admin API readiness failed after 30 attempts") from None
            print(f"Keycloak Admin API readiness check {attempt} failed; retrying in 2 seconds", flush=True)
            sleep(2)

    resources = Path(__file__).resolve().parent
    api.call("PUT", "/users/profile", json.loads((resources / "bootstrap-user-profile.json").read_text()))
    public_id = api.upsert_client({
        "clientId": env["OIDC_CLIENT_ID"], "enabled": True, "publicClient": True,
        "directAccessGrantsEnabled": True, "standardFlowEnabled": True,
        "redirectUris": [env["OIDC_REDIRECT_URI"]], "webOrigins": [env["OIDC_WEB_ORIGIN"]],
        "protocol": "openid-connect",
    })
    api.audience(public_id, env["OIDC_CLIENT_ID"])
    studio = json.loads((resources / "studio-plugin-client.json").read_text())
    studio_id = api.upsert_client(studio)
    api.audience(studio_id, env["OIDC_CLIENT_ID"])
    figma = json.loads((resources / "figma-plugin-client.json").read_text())
    figma_id = api.upsert_client(figma)
    api.audience(figma_id, env["OIDC_CLIENT_ID"])
    projects_id = api.upsert_client(service_client(
        env["PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID"], "Projects Service Lookup",
        env["PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET"],
    ))
    # Импортированные пользователи с ролью user должны получать offline_access для device login.
    if api.call("GET", "/roles/user", missing_ok=True) is None:
        api.call("POST", "/roles", {"name": "user", "description": "Default DS Builder user"})
    offline_access = api.call("GET", "/roles/offline_access")
    api.call("POST", "/roles/user/composites", [offline_access])
    api.grant_roles(projects_id, ["query-users", "view-users"], "realm-management")
    if env.get("PREVIEW_PUBLISHER_CLIENT_SECRET"):
        role = "compose_preview_publisher"
        if api.call("GET", "/roles/" + role, missing_ok=True) is None:
            api.call("POST", "/roles", {
                "name": role, "description": "Publishes Compose preview plugin builds",
            })
        publisher_id = api.upsert_client(service_client(
            env.get("PREVIEW_PUBLISHER_CLIENT_ID") or "dsbuilder-preview-publisher",
            "DS Builder Compose preview publisher", env["PREVIEW_PUBLISHER_CLIENT_SECRET"],
        ))
        api.audience(publisher_id, env["OIDC_CLIENT_ID"])
        api.grant_roles(publisher_id, [role])
    print("Keycloak production bootstrap completed", flush=True)


if __name__ == "__main__":
    try:
        bootstrap(os.environ)
    except (BootstrapError, HTTPError, URLError, TimeoutError, ValueError, KeyError, OSError) as failure:
        # Не выводим ответы сервера, HTTP-заголовки, окружение или значения credentials.
        message = str(failure) if isinstance(failure, BootstrapError) else type(failure).__name__
        print(f"Keycloak production bootstrap failed: {message}", file=sys.stderr)
        sys.exit(1)
