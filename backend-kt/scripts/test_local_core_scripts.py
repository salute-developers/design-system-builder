"""Регрессии локальных инструкций Core без сети, Gradle и пользовательских данных."""
import json
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class LocalCoreScriptsTest(unittest.TestCase):
    def test_refresh_builds_with_empty_flags_on_system_bash(self):
        for flags in ([], ["--core-version", "0.57.0-dev.local"]):
            with self.subTest(flags=flags), tempfile.TemporaryDirectory() as directory:
                gradle = Path(directory) / "gradlew"
                gradle.write_text('#!/bin/sh\nprintf "arg:%s\\n" "$@"\nexit 42\n')
                gradle.chmod(0o755)
                result = subprocess.run(
                    ["/bin/bash", str(ROOT / "refresh-local-dev-assets.sh"), "--plasma-android", directory, *flags],
                    text=True, capture_output=True, check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("arg::preview-compose-plugin:previewPluginArtifact", result.stdout)
                self.assertNotIn("unbound variable", result.stderr)
                self.assertNotIn("previewCoreVersion", result.stdout)
                if flags:
                    self.assertIn("arg:-PcoreVersion=0.57.0-dev.local", result.stdout)

    def test_bootstrap_requires_meta_version_before_network_or_dependency_lookup(self):
        env = {key: value for key, value in os.environ.items() if key != "DSBUILDER_WEB_CORE_VERSION"}
        env["DSBUILDER_WEB_API_META"] = "/not-read-without-version.json"
        result = subprocess.run(
            ["/bin/bash", str(ROOT / "backend-kt/bootstrap-base.sh")],
            text=True, capture_output=True, env=env, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_setup_checks_meta_version_before_any_stack_changes(self):
        for arguments, version, external in (
            ([], None, False), ([], None, True), (["--reset"], "  ", True),
            (["--down"], None, True), (["--backend-only"], None, True), ([], "0.391.0-dev.local", True),
        ):
            with self.subTest(arguments=arguments, version=version, external=external), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                shutil.copy2(ROOT / "setup-local.sh", root / "setup-local.sh")
                (root / "backend-kt").mkdir()
                (root / "bin").mkdir()
                docker = root / "bin/docker"
                docker.write_text('#!/bin/sh\nprintf "docker:%s\\n" "$*" >> "$SETUP_TEST_LOG"\n')
                backend = root / "backend-kt/start-local.sh"
                backend.write_text('#!/bin/sh\nprintf "backend:%s\\n" "$*" >> "$SETUP_TEST_LOG"\n[ "$1" = "--down" ] || exit 42\n')
                docker.chmod(0o755)
                backend.chmod(0o755)
                log = root / "calls.log"
                env = {key: value for key, value in os.environ.items() if key not in ("DSBUILDER_WEB_CORE_VERSION", "DSBUILDER_WEB_API_META", "COMPOSE_COMPONENTS_PACKAGE", "COMPOSE_PREVIEW_PLUGIN_ZIP", "WEB_PREVIEW_PLUGIN_ZIP", "LOCAL_ICONS_SOURCE")}
                env.update(PATH=str(root / "bin") + os.pathsep + env["PATH"], SETUP_TEST_LOG=str(log))
                if external:
                    env["DSBUILDER_WEB_API_META"] = "/external.json"
                if version is not None:
                    env["DSBUILDER_WEB_CORE_VERSION"] = version
                result = subprocess.run(["/bin/bash", str(root / "setup-local.sh"), *arguments], env=env, text=True, capture_output=True, check=False)
                needs_version = external and arguments not in (["--down"], ["--backend-only"])
                if needs_version and not (version or "").strip():
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
                    self.assertFalse(log.exists(), "Docker or backend ran before version validation")
                else:
                    self.assertNotIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
                    self.assertIn("backend:", log.read_text())
                    if arguments == ["--down"]:
                        self.assertEqual(result.returncode, 0)

    def test_web_archive_supplies_the_exact_meta_and_version(self):
        archive = ROOT / "local-dev/web-preview/preview-web-plugin.zip"
        command = [
            "python3", str(ROOT / "backend-kt/scripts/normalize_web_api_meta.py"),
            str(archive), "--archive", "--channel", "dev",
        ]
        result = subprocess.run(command, text=True, capture_output=True, check=True)
        body = json.loads(result.stdout)
        self.assertEqual(body["channel"], "dev")
        self.assertEqual(body["coreRelease"]["platform"], "web")
        self.assertTrue(body["coreRelease"]["version"])
        self.assertTrue(any(prop["stateSupport"]["states"] for component in body["components"] for prop in component["properties"]))
        mismatch = subprocess.run(command + ["--core-version", "0.0.0"], text=True, capture_output=True)
        self.assertNotEqual(mismatch.returncode, 0)
        self.assertIn("differs from the configured value", mismatch.stderr)

    def test_setup_enables_compose_registration_and_reuses_the_web_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy2(ROOT / "setup-local.sh", root / "setup-local.sh")
            (root / "backend-kt").mkdir()
            (root / "bin").mkdir()
            compose_archive = root / "local-dev/compose-preview/preview-compose-plugin.zip"
            compose_archive.parent.mkdir(parents=True)
            compose_archive.write_text("compose-archive")
            stubs = {
                "bin/docker": "exit 0",
                "bin/curl": '''
while [ "$1" != "--output" ]; do shift; done
printf "download|%s\n" "$3" >> "$SETUP_TEST_LOG"
printf "web-archive" > "$2"
''',
                "backend-kt/start-local.sh": "exit 0",
                "backend-kt/bootstrap-base.sh": '''
test "$(cat "$WEB_PREVIEW_PLUGIN_ZIP")" = "web-archive"
test "$DSBUILDER_PROJECT_CLIENT_ID" = dsbuilder-api
test "$GATEWAY_URL" = "$DSBUILDER_GATEWAY_URL"
printf "bootstrap|%s\n" "$WEB_PREVIEW_PLUGIN_ZIP" >> "$SETUP_TEST_LOG"
printf "rebuilt-web-archive" > "$SETUP_TEST_ORIGINAL"
''',
                "publish-preview-plugin.sh": '''
test "$GATEWAY_URL" = http://localhost:18080
if [ "$2" = compose ]; then
    test "$7" = --register-core
    test "$(cat "$6")" = "compose-archive"
    printf "compose|%s\n" "$6" >> "$SETUP_TEST_LOG"
else
    test "$2" = react
    test "$#" = 6
    test "$(cat "$6")" = "web-archive"
    printf "publish|%s\n" "$6" >> "$SETUP_TEST_LOG"
fi
''',
            }
            for name, script in stubs.items():
                path = root / name
                path.write_text("#!/bin/sh\nset -eu\n" + script + "\n")
                path.chmod(0o755)
            log = root / "calls.log"
            env = {
                key: value for key, value in os.environ.items()
                if key not in ("DSBUILDER_WEB_API_META", "COMPOSE_PREVIEW_PLUGIN_ZIP", "COMPOSE_COMPONENTS_PACKAGE")
            }
            env.pop("DSBUILDER_PROJECT_CLIENT_ID", None)
            env.update(PATH=str(root / "bin") + os.pathsep + env["PATH"], SETUP_TEST_LOG=str(log),
                       DSBUILDER_GATEWAY_URL="http://localhost:18080", GATEWAY_URL="http://other.test",
                       DSBUILDER_CLIENT_ID="publisher-client")
            original = root / "web.zip"
            url = "https://example.test/preview-web-plugin.zip"
            env["SETUP_TEST_ORIGINAL"] = str(original)
            for source in (url, str(original)):
                with self.subTest(source=source):
                    original.write_text("web-archive")
                    log.write_text("")
                    result = subprocess.run(
                        ["/bin/bash", str(root / "setup-local.sh"), "--web-plugin-zip", source, "--skip-icons"],
                        env=env, text=True, capture_output=True, check=False,
                    )
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    calls = log.read_text().splitlines()
                    if source == url:
                        self.assertEqual(calls.pop(0), "download|" + url)
                    bootstrap, compose, publication = calls
                    self.assertEqual(compose, "compose|" + str(compose_archive))
                    archive = bootstrap.removeprefix("bootstrap|")
                    self.assertEqual(publication, "publish|" + archive)
                    self.assertFalse(Path(archive).exists())
                    self.assertEqual(original.read_text(), "rebuilt-web-archive")

    def test_compose_registration_and_publication_share_one_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "backend-kt").mkdir()
            shutil.copy2(ROOT / "publish-preview-plugin.sh", root / "publish-preview-plugin.sh")
            stubs = {
                "curl": """printf "download|%s\n" "$4" >> "$SETUP_TEST_LOG"
printf "compose-archive" > "$3"
""",
                "backend-kt/bootstrap-base.sh": """test "$1" = --import-core-request
test "$DSBUILDER_GATEWAY_URL" = http://localhost:18080
test "$DSBUILDER_PROJECT_CLIENT_ID" = dsbuilder-api
test "$(cat "$2")" = core-json
printf "register\n" >> "$SETUP_TEST_LOG"
printf "rebuilt-archive" > "$SETUP_TEST_ORIGINAL"
exit "$REGISTER_EXIT"
""",
                "cli": """test "$4" = compose
test "$6" = dev
test "$(cat "$8")" = compose-archive
if [ "$9" = --print-core-import-request ]; then
    printf "prepare|%s\n" "$8" >> "$SETUP_TEST_LOG"
    printf "core-json"
else
    test "$9" = --api-url
    test "${10}" = http://localhost:18080
    test "${11}" = --apply
    test "$DSBUILDER_CLIENT_ID" = publisher-client
    printf "publish|%s\n" "$8" >> "$SETUP_TEST_LOG"
fi
""",
            }
            for name, script in stubs.items():
                path = root / name
                path.write_text("#!/bin/sh\nset -eu\n" + script)
                path.chmod(0o755)
            log = root / "calls.log"
            original = root / "original.zip"
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ["PATH"],
                       SETUP_TEST_LOG=str(log), SETUP_TEST_ORIGINAL=str(original),
                       DSBUILDER_CLI=str(root / "cli"), DSBUILDER_CLIENT_ID="publisher-client")
            env.pop("DSBUILDER_PROJECT_CLIENT_ID", None)
            url = "https://example.test/preview-compose-plugin.zip"
            for source, register_exit in ((url, 0), (url, 3), (str(original), 0)):
                with self.subTest(source=source, register_exit=register_exit):
                    original.write_text("compose-archive")
                    log.write_text("")
                    command = ["/bin/bash", str(root / "publish-preview-plugin.sh"), "--platform", "compose",
                               "--channel", "dev", "--from", source, "--gateway-url", "http://localhost:18080",
                               "--register-core"]
                    result = subprocess.run(command, env=dict(env, REGISTER_EXIT=str(register_exit)),
                                            capture_output=True, text=True, check=False)
                    self.assertEqual(result.returncode, register_exit, result.stdout + result.stderr)
                    calls = log.read_text().splitlines()
                    if source == url:
                        self.assertEqual(calls.pop(0), "download|" + url)
                    preparation, registration, *publication = calls
                    archive = preparation.removeprefix("prepare|")
                    self.assertEqual(registration, "register")
                    self.assertEqual(publication, ["publish|" + archive] if register_exit == 0 else [])
                    self.assertFalse(Path(archive).exists())
                    self.assertEqual(original.read_text(), "rebuilt-archive")

    def test_web_publication_uses_the_checkout_cli_unless_explicitly_overridden(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy2(ROOT / "publish-preview-plugin.sh", root / "publish-preview-plugin.sh")
            log = root / "calls.log"
            archive = root / "web.zip"
            archive.touch()
            stubs = {
                "bin/dsbuilder": """printf 'installed\n' >> "$SETUP_TEST_LOG"
""",
                "frontend-kt/gradlew": """test "$*" = '--quiet :cli:installJvmDist'
printf 'build\n' >> "$SETUP_TEST_LOG"
""",
                "frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder": """printf 'jvm\n' >> "$SETUP_TEST_LOG"
""",
            }
            for name, script in stubs.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("#!/bin/sh\nset -eu\n" + script)
                path.chmod(0o755)

            env = dict(os.environ, PATH=str(root / "bin") + os.pathsep + os.environ["PATH"], SETUP_TEST_LOG=str(log))
            env.pop("DSBUILDER_CLI", None)
            args = ["/bin/bash", str(root / "publish-preview-plugin.sh"), "--platform", "react",
                    "--channel", "dev", "--from", str(archive)]
            for override, expected in (([], ["build", "jvm"]),
                                       (["--cli", str(root / "bin/dsbuilder")], ["installed"])):
                with self.subTest(override=override):
                    log.write_text("")
                    result = subprocess.run(args + override, env=env, capture_output=True, text=True, check=False)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(log.read_text().splitlines(), expected)

    def test_powershell_setup_places_the_version_gate_before_docker(self):
        source = (ROOT / "setup-local.ps1").read_text()
        gate = source.index("if (-not $Down -and $env:DSBUILDER_WEB_API_META -and [string]::IsNullOrWhiteSpace($env:DSBUILDER_WEB_CORE_VERSION))")
        self.assertLess(gate, source.index("Invoke-Checked 'Docker Compose availability'"))
        self.assertLess(gate, source.index("if ($Reset) {"))


if __name__ == "__main__":
    unittest.main()
