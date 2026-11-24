"""Регрессии локальных инструкций Core без сети, Gradle и пользовательских данных."""
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
        result = subprocess.run(
            ["/bin/bash", str(ROOT / "backend-kt/bootstrap-base.sh")],
            text=True, capture_output=True, env=env, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_setup_checks_meta_version_before_any_stack_changes(self):
        for arguments, version in (([], None), (["--reset"], None), (["--reset"], "  "), (["--down"], None), (["--backend-only"], None), ([], "0.391.0-dev.local")):
            with self.subTest(arguments=arguments, version=version), tempfile.TemporaryDirectory() as directory:
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
                env = {key: value for key, value in os.environ.items() if key not in ("DSBUILDER_WEB_CORE_VERSION", "COMPOSE_COMPONENTS_PACKAGE", "COMPOSE_PREVIEW_PLUGIN_ZIP", "WEB_PREVIEW_PLUGIN_ZIP", "LOCAL_ICONS_SOURCE")}
                env.update(PATH=str(root / "bin") + os.pathsep + env["PATH"], SETUP_TEST_LOG=str(log))
                if version is not None:
                    env["DSBUILDER_WEB_CORE_VERSION"] = version
                result = subprocess.run(["/bin/bash", str(root / "setup-local.sh"), *arguments], env=env, text=True, capture_output=True, check=False)
                needs_version = arguments not in (["--down"], ["--backend-only"])
                if needs_version and not (version or "").strip():
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
                    self.assertFalse(log.exists(), "Docker or backend ran before version validation")
                else:
                    self.assertNotIn("Set DSBUILDER_WEB_CORE_VERSION", result.stderr)
                    self.assertIn("backend:", log.read_text())
                    if arguments == ["--down"]:
                        self.assertEqual(result.returncode, 0)

    def test_powershell_setup_places_the_version_gate_before_docker(self):
        source = (ROOT / "setup-local.ps1").read_text()
        gate = source.index("if (-not $Down -and [string]::IsNullOrWhiteSpace($env:DSBUILDER_WEB_CORE_VERSION))")
        self.assertLess(gate, source.index("Invoke-Checked 'Docker Compose availability'"))
        self.assertLess(gate, source.index("if ($Reset) {"))


if __name__ == "__main__":
    unittest.main()
