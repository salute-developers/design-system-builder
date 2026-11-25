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

    def test_setup_reuses_one_web_download_and_cleans_it_up(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy2(ROOT / "setup-local.sh", root / "setup-local.sh")
            (root / "backend-kt").mkdir()
            (root / "bin").mkdir()
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
printf "bootstrap|%s\n" "$WEB_PREVIEW_PLUGIN_ZIP" >> "$SETUP_TEST_LOG"
''',
                "publish-preview-plugin.sh": '''
test "$2" = react
test "$(cat "$6")" = "web-archive"
printf "publish|%s\n" "$6" >> "$SETUP_TEST_LOG"
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
            env.update(PATH=str(root / "bin") + os.pathsep + env["PATH"], SETUP_TEST_LOG=str(log))
            url = "https://example.test/preview-web-plugin.zip"
            result = subprocess.run(
                ["/bin/bash", str(root / "setup-local.sh"), "--web-plugin-zip", url, "--skip-icons"],
                env=env, text=True, capture_output=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            download, bootstrap, publication = log.read_text().splitlines()
            self.assertEqual(download, "download|" + url)
            archive = bootstrap.removeprefix("bootstrap|")
            self.assertEqual(publication, "publish|" + archive)
            self.assertFalse(Path(archive).exists())

    def test_powershell_setup_places_the_version_gate_before_docker(self):
        source = (ROOT / "setup-local.ps1").read_text()
        gate = source.index("if (-not $Down -and $env:DSBUILDER_WEB_API_META -and [string]::IsNullOrWhiteSpace($env:DSBUILDER_WEB_CORE_VERSION))")
        self.assertLess(gate, source.index("Invoke-Checked 'Docker Compose availability'"))
        self.assertLess(gate, source.index("if ($Reset) {"))


if __name__ == "__main__":
    unittest.main()
