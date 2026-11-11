import importlib.util
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

DIST = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', DIST / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def make_archive(directory, target, binary=b'#!/bin/sh\necho fixture\n', ios_tag='release-14-10-2026', include_ios=True):
    root = f'dsbuilder-cli-{target}'
    files = {'USAGE.md': b'fixture'}
    if target == 'windows-x64':
        files.update({'dsbuilder.exe': binary, 'install.ps1': (DIST / 'install-windows-cli.ps1').read_bytes()})
    else:
        files['install.sh'] = (DIST / ('install-jvm-cli.sh' if target == 'jvm' else 'install-macos-cli.sh')).read_bytes()
        files['install-unix-common.sh'] = (DIST / 'install-unix-common.sh').read_bytes()
        files['bin/dsbuilder' if target == 'jvm' else 'dsbuilder'] = binary
        if target == 'jvm':
            files['lib/fixture.jar'] = b'fixture'
        if target == 'macos-arm64' and include_ios:
            ios_data = BytesIO()
            with zipfile.ZipFile(ios_data, 'w') as ios:
                ios.writestr('dsbuilder-ios-cli/dsbuilder-ios', b'ios fixture')
                ios.writestr('dsbuilder-ios-cli/ios-api-meta.json', b'{}')
            files['ios-release.txt'] = (ios_tag + '\n').encode()
            files[f'ios/dsbuilder-ios-cli-{ios_tag}.zip'] = ios_data.getvalue()
    path = directory / f'{root}.zip'
    with zipfile.ZipFile(path, 'w') as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo(f'{root}/{name}')
            info.external_attr = 0o100755 << 16
            archive.writestr(info, data)
    return path


class MemoryStore:
    def __init__(self):
        self.data = {}
        self.fail = None
        self.writes = []

    def get(self, key):
        return self.data.get(key)

    def put(self, key, data):
        if key == self.fail:
            raise RuntimeError('Interrupted upload')
        self.writes.append(key)
        self.data[key] = data


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        for target in release.TARGETS:
            make_archive(self.directory, target)
        release.prepare(self.directory, '1.2.3', 'https://example.invalid/cli', DIST / 'bootstrap')
        self.store = MemoryStore()
    def test_tag_validation(self):
        self.assertEqual('1.2.3', release.tag_version('cli-v1.2.3'))
        for tag in ('v1.2.3', 'cli-v01.2.3', 'cli-v1.2', 'cli-v1.2.3;echo bad', 'cli-v1.2.3\n'):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                release.tag_version(tag)

    def test_manifest_and_rendered_scripts(self):
        manifest = json.loads((self.directory / 'release.json').read_bytes())
        self.assertEqual('release-14-10-2026', manifest['iosCliReleaseTag'])
        self.assertEqual(set(release.TARGETS), set(manifest['artifacts']))
        for artifact in manifest['artifacts'].values():
            self.assertEqual(release.digest((self.directory / artifact['file']).read_bytes()), artifact['sha256'])
        self.assertIn('https://github.com/salute-developers/design-system-builder', (self.directory / 'install.sh').read_text())
        self.assertNotIn('@CLI_RELEASE_BASE_URL@', (self.directory / 'install.ps1').read_text())

    def test_missing_archive_prevents_preparation(self):
        (self.directory / 'dsbuilder-cli-jvm.zip').unlink()
        with self.assertRaises(FileNotFoundError):
            release.prepare(self.directory, '1.2.3', 'https://example.invalid/cli', DIST / 'bootstrap')

    def test_archive_traversal_and_symlink_are_rejected(self):
        path = self.directory / 'dsbuilder-cli-macos-arm64.zip'
        for name, mode in [('dsbuilder-cli-macos-arm64/../escape', 0o100755),
                           ('dsbuilder-cli-macos-arm64/link', 0o120777)]:
            make_archive(self.directory, 'macos-arm64')
            with zipfile.ZipFile(path, 'a') as archive:
                info = zipfile.ZipInfo(name)
                info.external_attr = mode << 16
                archive.writestr(info, b'payload')
            with self.assertRaises(ValueError):
                release.validate_archive(path, 'macos-arm64')

    def test_arm64_requires_valid_ios_cli_and_other_targets_exclude_it(self):
        arm = self.directory / 'dsbuilder-cli-macos-arm64.zip'
        make_archive(self.directory, 'macos-arm64', include_ios=False)
        with self.assertRaisesRegex(ValueError, 'missing its bundled iOS CLI'):
            release.validate_archive(arm, 'macos-arm64')
        for tag in ('unsafe/tag', 'current'):
            with self.subTest(tag=tag):
                make_archive(self.directory, 'macos-arm64', ios_tag=tag)
                with self.assertRaises(ValueError):
                    release.validate_archive(arm, 'macos-arm64')
        x64 = self.directory / 'dsbuilder-cli-macos-x64.zip'
        with zipfile.ZipFile(x64, 'a') as archive:
            archive.writestr('dsbuilder-cli-macos-x64/ios-release.txt', 'release-14-10-2026')
        with self.assertRaises(ValueError):
            release.validate_archive(x64, 'macos-x64')

    def remote(self, selected='1.2.3'):
        return FakeGitHub('cli-v' + selected)

    def test_draft_upload_resume_and_published_retry(self):
        remote = self.remote()
        remote.fail = 'dsbuilder-cli-windows-x64.zip'
        with self.assertRaises(RuntimeError):
            release.prepare_github(remote, self.directory)
        self.assertTrue(remote.view()['draft'])
        remote.fail = None
        release.prepare_github(remote, self.directory)
        remote.publish(True)
        previous = dict(remote.data)
        make_archive(self.directory, 'jvm', binary=b'changed build')
        self.assertTrue(release.prepare_github(remote, self.directory))
        self.assertEqual(previous, remote.data)
        remote.data['dsbuilder-cli-jvm.zip'] = b'broken'
        with self.assertRaises(ValueError):
            release.prepare_github(remote, self.directory)

    def test_manifest_and_remote_integrity(self):
        for field in ('schemaVersion', 'version', 'iosCliReleaseTag', 'artifacts'):
            remote = self.remote()
            release.prepare_github(remote, self.directory)
            manifest = json.loads(remote.data['release.json'])
            manifest[field] = None
            remote.data['release.json'] = release.json_bytes(manifest)
            with self.subTest(field=field), self.assertRaises(ValueError):
                release.verified_remote_release(remote, '1.2.3')

    def test_first_latest_old_release_and_published_retry(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        release.promote_github(remote)
        self.assertEqual([True], remote.promotions)
        # Повтор опубликованного тега не двигает указатель.
        release.promote_github(remote)
        self.assertEqual([True], remote.promotions)
        older = self.remote()
        release.prepare_github(older, self.directory)
        newer = self.remote('1.10.0')
        release.prepare(self.directory, '1.10.0', 'https://example.invalid/cli', DIST / 'bootstrap')
        release.prepare_github(newer, self.directory)
        newer.publish(True)
        older.current_latest = newer.view()
        with patch.object(release, 'GitHubRelease', return_value=newer):
            release.promote_github(older)
            self.assertEqual([False], older.promotions)
            release.promote_github(older)
            self.assertEqual([False], older.promotions)

    def test_prerelease_and_foreign_latest_are_rejected(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        remote.metadata['prerelease'] = True
        with self.assertRaises(ValueError):
            release.promote_github(remote)
        remote.metadata['prerelease'] = False
        remote.current_latest = {'tag_name': 'other-v2.0.0'}
        with self.assertRaises(ValueError):
            release.promote_github(remote)
        self.assertEqual([], remote.promotions)

    def test_s3_only_two_keys_overwritten_and_failure_can_resume(self):
        release.upload_installers(self.store, self.directory)
        self.assertEqual({'install.sh', 'install.ps1'}, set(self.store.data))
        self.store.fail = 'install.ps1'
        (self.directory / 'install.sh').write_text('older installer')
        with self.assertRaises(RuntimeError):
            release.upload_installers(self.store, self.directory)
        self.store.fail = None
        release.upload_installers(self.store, self.directory)
        self.assertEqual(b'older installer', self.store.get('install.sh'))
        self.assertEqual(3, self.store.writes.count('install.sh'))
        self.assertEqual({'install.sh', 'install.ps1'}, set(self.store.data))

    def test_s3_verification_is_required(self):
        self.store.put = lambda key, data: None
        with self.assertRaises(RuntimeError):
            release.upload_installers(self.store, self.directory)

    def test_public_url_validation(self):
        for url in ('http://example.invalid', 'https://user:password@example.invalid',
                    "https://example.invalid/'$(echo bad)", 'https://example.invalid/#fragment'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                release.prepare(self.directory, '1.2.3', url, DIST / 'bootstrap')


class FakeGitHub(MemoryStore):
    def __init__(self, tag):
        super().__init__()
        self.tag = tag
        self.metadata = None
        self.current_latest = None
        self.promotions = []

    def view(self):
        return self.metadata

    def create(self):
        self.metadata = {'tag_name': self.tag, 'draft': True, 'prerelease': False}

    def latest(self):
        return self.current_latest

    def upload(self, directory):
        for key, data in release.release_files(directory).items():
            self.put(key, data)

    def publish(self, latest):
        self.metadata['draft'] = False
        self.promotions.append(latest)


class GitHubAdapterTest(unittest.TestCase):
    def test_only_404_is_missing_and_other_errors_fail(self):
        import subprocess
        remote = release.GitHubRelease('cli-v1.2.3')
        for stderr in (b'gh: Not Found (HTTP 404)', b'gh: Forbidden (HTTP 403)', b'network failure'):
            with patch.object(remote, 'run', side_effect=subprocess.CalledProcessError(1, ['gh'], stderr=stderr)):
                if b'404' in stderr:
                    self.assertIsNone(remote.view())
                else:
                    with self.assertRaises(RuntimeError):
                        remote.view()

    def test_draft_and_promotion_commands_are_explicit(self):
        remote = release.GitHubRelease('cli-v1.2.3')
        with patch.object(remote, 'run') as run:
            remote.create()
            self.assertIn('--verify-tag', run.call_args.args)
            self.assertIn('--draft', run.call_args.args)
            remote.publish(False)
            self.assertIn('--latest=false', run.call_args.args)
            remote.publish(True)
            self.assertIn('--latest=true', run.call_args.args)
