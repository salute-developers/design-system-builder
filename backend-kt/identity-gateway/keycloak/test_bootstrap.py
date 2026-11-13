"""Контракт bootstrap с HTTP Admin API: повторный запуск, роли и ошибки."""

import contextlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import io
import json
from pathlib import Path
from threading import Thread
import unittest
from urllib.parse import parse_qs, urlsplit

SPEC = importlib.util.spec_from_file_location("bootstrap", Path(__file__).with_name("bootstrap-production-keycloak.py"))
bootstrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bootstrap)


class FakeAdmin(BaseHTTPRequestHandler):
    """HTTP-сервер сохраняет состояние между запусками bootstrap, как существующий realm."""

    def log_message(self, *_args):
        pass

    def respond(self, status, body=None):
        payload = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def handle_api(self):
        state = self.server.state
        split = urlsplit(self.path)
        path = split.path.removeprefix("/admin/realms/fixture")
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if split.path == "/realms/master/protocol/openid-connect/token":
            state["login_forms"].append(parse_qs(body.decode()))
            return self.respond(200, {"access_token": "fixture-token"})
        if self.headers.get("Authorization") != "Bearer fixture-token":
            return self.respond(401)
        if path == "" and state["readiness_failures"]:
            state["readiness_failures"] -= 1
            return self.respond(503)
        if path == "" and self.command == "PUT":
            state["realm"] = json.loads(body)
            return self.respond(204)
        if path == "/users/profile":
            state["profile"] = json.loads(body)
            return self.respond(204)
        if path == "/clients" and self.command == "GET":
            if state["expire_token"]:
                state["expire_token"] = False
                return self.respond(401)
            client_id = parse_qs(split.query)["clientId"][0]
            return self.respond(200, [c for c in state["clients"].values() if c["clientId"] == client_id])
        if path == "/clients" and self.command == "POST":
            client = json.loads(body)
            client["id"] = "client-" + str(len(state["clients"]))
            state["clients"][client["id"]] = client
            return self.respond(201)
        if path.startswith("/clients/"):
            _, _, client_id, *tail = path.split("/")
            if not tail and self.command == "PUT":
                state["clients"][client_id].update(json.loads(body))
                return self.respond(204)
            if tail == ["protocol-mappers", "models"]:
                mappers = state["mappers"].setdefault(client_id, [])
                if self.command == "POST":
                    mappers.append(json.loads(body))
                    return self.respond(201)
                return self.respond(200, mappers)
            if tail == ["service-account-user"]:
                return self.respond(200, {"id": "user-" + client_id})
            if tail[:1] == ["roles"]:
                return self.respond(200, {"id": "role-" + tail[1], "name": tail[1]})
        if path == "/roles" and self.command == "POST":
            role = json.loads(body)
            state["roles"][role["name"]] = dict(role, id="realm-role")
            return self.respond(201)
        if path == "/roles/user/composites" and self.command == "POST":
            state["composites"].update(role["name"] for role in json.loads(body))
            return self.respond(204)
        if path.startswith("/roles/"):
            role = state["roles"].get(path.removeprefix("/roles/"))
            return self.respond(200 if role else 404, role)
        if path.startswith("/users/") and "/role-mappings/" in path:
            if state["deny_roles"]:
                return self.respond(403, {"error": "fixture-secret-must-not-be-logged"})
            state["mappings"].setdefault(path, set()).update(role["name"] for role in json.loads(body))
            return self.respond(204)
        self.respond(404)

    do_GET = handle_api
    do_POST = handle_api
    do_PUT = handle_api


class BootstrapTest(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeAdmin)
        self.server.state = {
            "clients": {"management": {"id": "management", "clientId": "realm-management"}},
            "mappers": {}, "roles": {"offline_access": {"id": "offline-role", "name": "offline_access"}},
            "composites": set(), "mappings": {}, "login_forms": [],
            "readiness_failures": 0, "expire_token": False, "deny_roles": False,
        }
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.env = {
            "KEYCLOAK_BOOTSTRAP_URL": f"http://127.0.0.1:{self.server.server_port}",
            "KEYCLOAK_REALM": "fixture", "KEYCLOAK_ADMIN": "admin+fixture",
            "KEYCLOAK_ADMIN_PASSWORD": 'password +&="special"',
            "OIDC_CLIENT_ID": "web", "OIDC_REDIRECT_URI": "https://fixture.test/callback",
            "OIDC_WEB_ORIGIN": "https://fixture.test",
            "PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID": "projects",
            "PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET": 'projects +&="special"',
        }
        self.output = io.StringIO()
        self.sleeps = []

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def run_bootstrap(self):
        with contextlib.redirect_stdout(self.output):
            bootstrap.bootstrap(self.env, sleep=self.sleeps.append)

    def client(self, name):
        return next(c for c in self.server.state["clients"].values() if c["clientId"] == name)

    def test_create_then_update_preserves_security_and_does_not_duplicate_clients_or_mappers(self):
        self.run_bootstrap()
        studio = self.client("dsbuilder-studio-plugin")
        studio["attributes"]["external-attribute"] = "keep"
        self.env["PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET"] = "rotated"
        self.run_bootstrap()
        state = self.server.state
        self.assertEqual(5, len(state["clients"]))
        self.assertEqual("rotated", self.client("projects")["secret"])
        self.assertFalse(self.client("projects")["publicClient"])
        self.assertTrue(self.client("projects")["serviceAccountsEnabled"])
        self.assertEqual([self.env["OIDC_REDIRECT_URI"]], self.client("web")["redirectUris"])
        self.assertTrue(self.client("web")["directAccessGrantsEnabled"])
        self.assertFalse(studio["directAccessGrantsEnabled"])
        self.assertEqual("S256", studio["attributes"]["pkce.code.challenge.method"])
        self.assertEqual("dsbuilder", studio["attributes"]["login_theme"])
        self.assertEqual("keep", studio["attributes"]["external-attribute"])
        self.assertTrue(all(len(mappers) == 1 for mappers in state["mappers"].values()))
        self.assertEqual([{"query-users", "view-users"}], list(state["mappings"].values()))
        self.assertEqual("ENABLED", state["profile"]["unmanagedAttributePolicy"])
        self.assertFalse(state["realm"]["registrationAllowed"])
        self.assertTrue(state["realm"]["offlineSessionMaxLifespanEnabled"])
        self.assertEqual(7776000, state["realm"]["offlineSessionMaxLifespan"])
        figma = self.client("dsbuilder-figma-plugin")
        self.assertTrue(figma["consentRequired"])
        self.assertEqual("true", figma["attributes"]["oauth2.device.authorization.grant.enabled"])
        self.assertEqual("7776000", figma["attributes"]["client.offline.session.max.lifespan"])
        self.assertEqual(self.env["KEYCLOAK_ADMIN_PASSWORD"], state["login_forms"][0]["password"][0])

    def test_optional_publisher_has_audience_and_only_required_realm_role(self):
        self.env["PREVIEW_PUBLISHER_CLIENT_SECRET"] = "publisher-secret"
        self.run_bootstrap()
        self.run_bootstrap()
        self.assertEqual(6, len(self.server.state["clients"]))
        publisher = self.client("dsbuilder-preview-publisher")
        self.assertFalse(publisher["standardFlowEnabled"])
        self.assertEqual("publisher-secret", publisher["secret"])
        self.assertIn({"compose_preview_publisher"}, self.server.state["mappings"].values())
        self.assertEqual(1, len(self.server.state["mappers"][publisher["id"]]))

    def test_imported_user_role_gains_offline_access_without_losing_existing_composites(self):
        self.server.state["roles"]["user"] = {"id": "existing-user-role", "name": "user"}
        self.server.state["composites"].add("existing-composite")
        self.run_bootstrap()
        self.run_bootstrap()
        self.assertEqual("existing-user-role", self.server.state["roles"]["user"]["id"])
        self.assertEqual({"existing-composite", "offline_access"}, self.server.state["composites"])

    def test_waits_for_realm_and_refreshes_expired_token(self):
        self.server.state.update(readiness_failures=1, expire_token=True)
        self.run_bootstrap()
        self.assertEqual([2], self.sleeps)
        self.assertEqual(2, len(self.server.state["login_forms"]))

    def test_role_failure_is_not_reported_as_success_and_does_not_leak_response_or_secrets(self):
        self.server.state["deny_roles"] = True
        with self.assertRaisesRegex(bootstrap.BootstrapError, "HTTP 403") as result:
            self.run_bootstrap()
        self.assertNotIn("completed", self.output.getvalue())
        text = str(result.exception) + self.output.getvalue()
        for secret in ["fixture-secret-must-not-be-logged", self.env["KEYCLOAK_ADMIN_PASSWORD"],
                       self.env["PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET"], "fixture-token"]:
            self.assertNotIn(secret, text)

    def test_readiness_has_bounded_retries(self):
        self.server.state["readiness_failures"] = 30
        with self.assertRaisesRegex(bootstrap.BootstrapError, "after 30 attempts"):
            self.run_bootstrap()
        self.assertEqual([2] * 29, self.sleeps)
        self.assertEqual(1, len(self.server.state["clients"]))


if __name__ == "__main__":
    unittest.main()
