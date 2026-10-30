import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

DIST = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', DIST / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def make_archive(directory, target, binary=b'#!/bin/sh\necho fixture\n'):
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

    def get(self, key):
        return self.data.get(key)

    def put(self, key, data):
        if key == self.fail:
            raise RuntimeError('Interrupted upload')
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
        self.assertEqual(set(release.TARGETS), set(manifest['artifacts']))
        for artifact in manifest['artifacts'].values():
            self.assertEqual(release.digest((self.directory / artifact['file']).read_bytes()), artifact['sha256'])
        self.assertIn('https://example.invalid/cli', (self.directory / 'install.sh').read_text())
        self.assertNotIn('@CLI_DOWNLOAD_BASE_URL@', (self.directory / 'install.ps1').read_text())

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

    def test_upload_retry_is_idempotent(self):
        release.upload(self.store, self.directory, '1.2.3')
        previous = dict(self.store.data)
        release.upload(self.store, self.directory, '1.2.3')
        self.assertEqual(previous, self.store.data)
        self.assertNotIn('stable.json', self.store.data)
        release.promote(self.store, self.directory, '1.2.3')
        self.assertEqual('1.2.3', json.loads(self.store.get('stable.json'))['version'])

    def test_conflict_does_not_write_or_promote(self):
        self.store.data['releases/1.2.3/dsbuilder-cli-jvm.zip'] = b'old'
        previous = dict(self.store.data)
        with self.assertRaises(ValueError):
            release.upload(self.store, self.directory, '1.2.3')
        self.assertEqual(previous, self.store.data)
        with self.assertRaises(RuntimeError):
            release.promote(self.store, self.directory, '1.2.3')

    def test_interruption_can_resume_without_moving_stable(self):
        pointer = release.json_bytes({'schemaVersion': 1, 'version': '1.0.0'})
        self.store.data['stable.json'] = pointer
        self.store.fail = 'releases/1.2.3/dsbuilder-cli-windows-x64.zip'
        with self.assertRaises(RuntimeError):
            release.upload(self.store, self.directory, '1.2.3')
        self.assertEqual(pointer, self.store.get('stable.json'))
        self.store.fail = None
        release.upload(self.store, self.directory, '1.2.3')
        release.promote(self.store, self.directory, '1.2.3')

    def test_older_release_does_not_downgrade(self):
        pointer = release.json_bytes({'schemaVersion': 1, 'version': '1.10.0'})
        self.store.data['stable.json'] = pointer
        release.upload(self.store, self.directory, '1.2.3')
        release.promote(self.store, self.directory, '1.2.3')
        self.assertEqual(pointer, self.store.get('stable.json'))
        self.assertNotIn('install.sh', self.store.data)

    def test_remote_verification_is_required(self):
        self.store.put = lambda key, data: None
        with self.assertRaises(RuntimeError):
            release.upload(self.store, self.directory, '1.2.3')

    def test_public_url_validation(self):
        for url in ('http://example.invalid', 'https://user:password@example.invalid',
                    "https://example.invalid/'$(echo bad)", 'https://example.invalid/#fragment'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                release.prepare(self.directory, '1.2.3', url, DIST / 'bootstrap')
