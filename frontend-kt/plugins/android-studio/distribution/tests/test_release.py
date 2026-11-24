"""Контракт упаковки и запрета перезаписи опубликованного выпуска."""

import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location("ide_release", Path(__file__).parents[1] / "release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


def plugin(path, version):
    jar = io.BytesIO()
    with zipfile.ZipFile(jar, "w") as library:
        library.writestr("META-INF/plugin.xml", "<idea-plugin><id>com.dsbuilder.frontend.plugin.androidstudio</id>"
                         f"<version>{version}</version></idea-plugin>")
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("DS Builder/lib/plugin.jar", jar.getvalue())


class ReleaseTests(unittest.TestCase):
    def test_tag_rejects_nonrelease_and_shell_metacharacters(self):
        for tag in ["cli-v1.2.3", "idea-plugin-v01.2.3", "idea-plugin-v1.2.3-beta", "idea-plugin-v1.2.3;echo x", "idea-plugin-v1٢.2.3"]:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                release.version(tag)

    def test_package_checks_embedded_version_before_copying(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            plugin(root / "plugin.zip", "9.9.9")
            with self.assertRaises(ValueError):
                release.package("idea-plugin-v1.2.3", root, root / "out")
            self.assertFalse((root / "out").exists())

    def test_existing_release_is_not_modified(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            plugin(root / "plugin.zip", "1.2.3")
            release.package("idea-plugin-v1.2.3", root, root / "out")
            before = {p.name: p.read_bytes() for p in (root / "out").iterdir()}
            with patch.object(release, "gh", return_value=subprocess.CompletedProcess([], 0, "123\n", "")) as gh:
                with self.assertRaisesRegex(ValueError, "уже существует"):
                    release.publish("idea-plugin-v1.2.3", root / "out", "owner/repo")
                self.assertEqual(gh.call_count, 1)
                self.assertEqual(gh.call_args.args[0], "api")
            self.assertEqual(before, {p.name: p.read_bytes() for p in (root / "out").iterdir()})

    def test_network_failure_does_not_create_release(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            plugin(root / "plugin.zip", "1.2.3")
            release.package("idea-plugin-v1.2.3", root, root / "out")
            with patch.object(release, "gh", return_value=subprocess.CompletedProcess([], 1, "", "connection refused")) as gh:
                with self.assertRaises(ValueError):
                    release.publish("idea-plugin-v1.2.3", root / "out", "owner/repo")
                self.assertEqual(gh.call_count, 1)

    def test_draft_discovery_uses_paginated_list_and_rejects_ambiguous_ids(self):
        with patch.object(release, "gh", return_value=subprocess.CompletedProcess([], 0, "456\n", "")) as gh:
            self.assertEqual("456", release.find_release("idea-plugin-v1.2.3", "owner/repo"))
            self.assertIn("--paginate", gh.call_args.args)
            self.assertIn("repos/owner/repo/releases?per_page=100", gh.call_args.args)
        for value in ["123\n456\n", "not-an-id\n"]:
            with self.subTest(value=value), patch.object(release, "gh", return_value=subprocess.CompletedProcess([], 0, value, "")):
                with self.assertRaises(ValueError):
                    release.find_release("idea-plugin-v1.2.3", "owner/repo")

    def test_only_verified_assets_are_published(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            plugin(root / "plugin.zip", "1.2.3")
            release.package("idea-plugin-v1.2.3", root, root / "out")
            assets = [{"name": p.name, "size": p.stat().st_size,
                       "digest": "sha256:" + release.hashlib.sha256(p.read_bytes()).hexdigest()}
                      for p in (root / "out").iterdir()]
            responses = [subprocess.CompletedProcess([], 0, "", ""),
                         subprocess.CompletedProcess([], 0, "", ""),
                         subprocess.CompletedProcess([], 0, "123\n", ""),
                         subprocess.CompletedProcess([], 0, json.dumps({"assets": assets}), ""),
                         subprocess.CompletedProcess([], 0, "", "")]
            with patch.object(release, "gh", side_effect=responses) as gh:
                release.publish("idea-plugin-v1.2.3", root / "out", "owner/repo")
                self.assertIn("draft=false", gh.call_args.args)
                self.assertIn("make_latest=false", gh.call_args.args)
                self.assertIn("repos/owner/repo/releases/123", gh.call_args_list[3].args)
                self.assertFalse(any("/releases/tags/" in str(call) for call in gh.call_args_list))


if __name__ == "__main__":
    unittest.main()
