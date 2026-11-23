import importlib.util
from io import BytesIO
import json
from pathlib import Path
import tempfile
import tarfile
from types import SimpleNamespace
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


def make_node_archive(directory, version='1.2.3'):
    manifest = {'name': '@sddsjs/design-system-builder-cli', 'version': version,
                'bin': {'dsbuilder': 'bin/dsbuilder.js'}, 'engines': {'node': '>=22'},
                'publishConfig': {'access': 'public'}}
    files = {'package.json': json.dumps(manifest).encode(), 'bin/dsbuilder.js': b'fixture',
             'dist/kotlin/design-system-builder-frontend-cli.js': b'fixture', 'README.md': b'fixture', 'LICENSE': b'fixture'}
    with tarfile.open(directory / 'dsbuilder-cli-node.tgz', 'w:gz') as archive:
        for name, data in files.items():
            entry = tarfile.TarInfo('package/' + name)
            entry.size = len(data)
            archive.addfile(entry, BytesIO(data))


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
        make_node_archive(self.directory)
        release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')
        self.store = MemoryStore()

    def test_new_release_requires_node_archive_and_immutable_metadata(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        manifest = json.loads(remote.data['release.json'])
        manifest.pop('node')
        remote.data['release.json'] = release.json_bytes(manifest)
        with self.assertRaises(ValueError):
            release.verified_remote_release(remote, '1.2.3')
        release.prepare_github(self.remote(), self.directory)
        archive = self.directory / 'dsbuilder-cli-node.tgz'
        archive.unlink()
        with self.assertRaises(FileNotFoundError):
            release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')

    def test_legacy_source_without_node_descriptor_preserves_old_contract(self):
        with patch.object(release, 'node_descriptor', return_value=None):
            release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')
            self.assertNotIn('node', json.loads((self.directory / 'release.json').read_bytes()))
            self.assertEqual(8, len(release.release_files(self.directory)))
            remote = self.remote()
            release.prepare_github(remote, self.directory)
            remote.publish(True)
            previous = dict(remote.data)
            remote.writes.clear()
            release.prepare_github(remote, self.directory)
            self.assertEqual(previous, remote.data)
            self.assertEqual([], remote.writes)

    def test_node_package_version_must_match_tag(self):
        make_node_archive(self.directory, '9.9.9')
        with self.assertRaises(ValueError):
            release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')

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
        self.assertIn('https://github.com/' + release.github_repository(), (self.directory / 'install.sh').read_text())
        self.assertNotIn('@CLI_RELEASE_BASE_URL@', (self.directory / 'install.ps1').read_text())

    def test_release_includes_both_rendered_installers(self):
        files = release.release_files(self.directory)
        self.assertEqual(9, len(files))
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        for name in release.INSTALLERS:
            self.assertEqual((self.directory / name).read_bytes(), remote.data[name])

    def test_legacy_published_release_gets_only_missing_installers(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        remote.publish(True)
        for name in release.INSTALLERS:
            remote.data.pop(name)
        previous = dict(remote.data)
        remote.writes.clear()
        make_archive(self.directory, 'jvm', binary=b'different rebuild')
        self.assertTrue(release.prepare_github(remote, self.directory))
        self.assertEqual(list(release.INSTALLERS), remote.writes)
        self.assertEqual(previous, {name: remote.data[name] for name in previous})
        self.assertEqual([True], remote.promotions)

    def test_partial_legacy_installer_upload_can_resume(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        remote.publish(True)
        for name in release.INSTALLERS:
            remote.data.pop(name)
        remote.fail = 'install.ps1'
        with self.assertRaises(RuntimeError):
            release.prepare_github(remote, self.directory)
        shell = remote.data['install.sh']
        remote.fail = None
        remote.writes.clear()
        release.prepare_github(remote, self.directory)
        self.assertEqual(['install.ps1'], remote.writes)
        self.assertEqual(shell, remote.data['install.sh'])
        self.assertEqual([True], remote.promotions)

    def test_broken_legacy_archives_prevent_installer_upload(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        remote.publish(True)
        for name in release.INSTALLERS:
            remote.data.pop(name)
        remote.data['dsbuilder-cli-jvm.zip'] = b'broken'
        remote.writes.clear()
        with self.assertRaises(ValueError):
            release.prepare_github(remote, self.directory)
        self.assertEqual([], remote.writes)

    def test_changed_published_installer_is_rejected_without_replacement(self):
        for name in release.INSTALLERS:
            with self.subTest(name=name):
                remote = self.remote()
                release.prepare_github(remote, self.directory)
                remote.publish(True)
                remote.data[name] = b'changed script'
                remote.writes.clear()
                with self.assertRaisesRegex(ValueError, 'Release installer mismatch'):
                    release.prepare_github(remote, self.directory)
                with self.assertRaisesRegex(ValueError, 'Release installer mismatch'):
                    release.promote_github(remote)
                self.assertEqual([], remote.writes)
                self.assertEqual(b'changed script', remote.data[name])
                self.assertEqual([True], remote.promotions)

    def test_draft_installer_upload_and_verification_must_finish_before_publish(self):
        remote = self.remote()
        remote.fail = 'install.ps1'
        with self.assertRaises(RuntimeError):
            release.prepare_github(remote, self.directory)
        self.assertTrue(remote.view()['draft'])
        with self.assertRaises(ValueError):
            release.promote_github(remote)
        remote.fail = None
        release.prepare_github(remote, self.directory)
        release.promote_github(remote)
        self.assertEqual([True], remote.promotions)

    def test_missing_archive_prevents_preparation(self):
        (self.directory / 'dsbuilder-cli-jvm.zip').unlink()
        with self.assertRaises(FileNotFoundError):
            release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')

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
        make_node_archive(self.directory, '1.10.0')
        release.prepare(self.directory, '1.10.0', DIST / 'bootstrap')
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

    def test_preparation_and_adapter_use_the_same_repository_without_s3_url(self):
        with patch.dict(release.os.environ, {'GITHUB_REPOSITORY': 'example/cli-fork'}):
            with patch.dict(release.os.environ):
                release.os.environ.pop('CLI_DOWNLOAD_BASE_URL', None)
                release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')
            self.assertEqual('example/cli-fork', release.GitHubRelease('cli-v1.2.3').repo)
            for script in ('install.sh', 'install.ps1'):
                self.assertIn('https://github.com/example/cli-fork', (self.directory / script).read_text())
        for repository in ('bad', 'owner/repo/extra', 'owner/repo?query', 'owner/repo\n'):
            with self.subTest(repository=repository), patch.dict(release.os.environ, {'GITHUB_REPOSITORY': repository}):
                with self.assertRaises(ValueError):
                    release.prepare(self.directory, '1.2.3', DIST / 'bootstrap')
                with self.assertRaises(ValueError):
                    release.GitHubRelease('cli-v1.2.3')

    def test_broken_previous_latest_does_not_block_a_new_complete_release(self):
        for previous in ('1.1.0', '1.10.0'):
            with self.subTest(previous=previous):
                remote = self.remote()
                release.prepare_github(remote, self.directory)
                # Старый Latest намеренно не содержит ни одного ассета.
                remote.current_latest = {'tag_name': 'cli-v' + previous}
                with patch.object(release, 'GitHubRelease', side_effect=AssertionError('Must not read old assets')):
                    release.promote_github(remote)
                self.assertEqual([previous == '1.1.0'], remote.promotions)

    def test_incomplete_target_release_still_cannot_be_published(self):
        remote = self.remote()
        release.prepare_github(remote, self.directory)
        remote.data.pop('dsbuilder-cli-jvm.zip')
        remote.current_latest = {'tag_name': 'cli-v1.1.0'}
        with self.assertRaises(RuntimeError):
            release.promote_github(remote)
        self.assertEqual([], remote.promotions)


class GitHubReleaseLookupTest(unittest.TestCase):
    def lookup(self, pages):
        remote = release.GitHubRelease('cli-v1.2.3')
        result = SimpleNamespace(stdout=json.dumps(pages).encode())
        with patch.object(remote, 'run', return_value=result) as run:
            info = remote.view()
        run.assert_called_once_with('api', '--paginate', '--slurp',
                                    f'repos/{remote.repo}/releases?per_page=100')
        return info

    def test_finds_draft_on_later_page_and_keeps_assets(self):
        draft = {'id': 42, 'tag_name': 'cli-v1.2.3', 'draft': True,
                 'assets': [{'name': 'release.json'}]}
        self.assertEqual(draft, self.lookup([
            [{'id': 43, 'tag_name': 'cli-v1.2.4', 'draft': False}], [draft],
        ]))

    def test_finds_published_release(self):
        published = {'id': 42, 'tag_name': 'cli-v1.2.3', 'draft': False}
        self.assertEqual(published, self.lookup([[published]]))

    def test_missing_release(self):
        self.assertIsNone(self.lookup([[]]))

    def test_duplicate_tag_is_rejected(self):
        draft = {'id': 42, 'tag_name': 'cli-v1.2.3', 'draft': True}
        with self.assertRaisesRegex(RuntimeError, 'Multiple GitHub releases'):
            self.lookup([[draft], [dict(draft, id=43)]])

    def test_prepare_reuses_existing_draft_on_retry(self):
        remote = release.GitHubRelease('cli-v1.2.3')
        draft = {'id': 42, 'tag_name': remote.tag, 'draft': True}
        result = SimpleNamespace(stdout=json.dumps([[draft]]).encode())
        directory = Path('distributions')
        with patch.object(remote, 'run', return_value=result), patch.object(remote, 'create') as create, \
                patch.object(remote, 'upload') as upload, patch.object(release, 'verified_remote_release') as verify:
            for _ in range(2):
                self.assertFalse(release.prepare_github(remote, directory))
            create.assert_not_called()
            self.assertEqual(2, upload.call_count)
            verify.assert_called_with(remote, '1.2.3')


class FakeGitHub(MemoryStore):
    def __init__(self, tag):
        super().__init__()
        self.tag = tag
        self.metadata = None
        self.current_latest = None
        self.promotions = []

    def view(self):
        return dict(self.metadata, assets=[{'name': name} for name in self.data]) if self.metadata else None

    def create(self):
        self.metadata = {'tag_name': self.tag, 'draft': True, 'prerelease': False}

    def latest(self):
        return self.current_latest

    def upload(self, directory, names=None, overwrite=True):
        for key in names if names is not None else release.release_files(directory):
            if not overwrite and key in self.data:
                raise RuntimeError('Asset already exists: ' + key)
            self.put(key, (directory / key).read_bytes())

    def publish(self, latest):
        self.metadata['draft'] = False
        self.promotions.append(latest)


class GitHubAdapterTest(unittest.TestCase):
    def test_adding_missing_installers_does_not_clobber_assets(self):
        remote = release.GitHubRelease('cli-v1.2.3')
        with patch.object(remote, 'run') as run:
            remote.upload(Path('distributions'), names=['install.sh'], overwrite=False)
            run.assert_called_once_with('release', 'upload', 'cli-v1.2.3', '--repo', remote.repo,
                                        str(Path('distributions') / 'install.sh'))

    def test_only_404_is_missing_and_other_errors_fail(self):
        import subprocess
        remote = release.GitHubRelease('cli-v1.2.3')
        for stderr in (b'gh: Not Found (HTTP 404)', b'gh: Forbidden (HTTP 403)', b'network failure'):
            with patch.object(remote, 'run', side_effect=subprocess.CalledProcessError(1, ['gh'], stderr=stderr)):
                if b'404' in stderr:
                    self.assertIsNone(remote.latest())
                else:
                    with self.assertRaises(RuntimeError):
                        remote.latest()

    def test_listing_errors_do_not_create_another_draft(self):
        import subprocess
        remote = release.GitHubRelease('cli-v1.2.3')
        for stderr in (b'gh: Not Found (HTTP 404)', b'gh: Forbidden (HTTP 403)', b'network failure'):
            with self.subTest(stderr=stderr), patch.object(
                remote, 'run', side_effect=subprocess.CalledProcessError(1, ['gh'], stderr=stderr)
            ), patch.object(remote, 'create') as create:
                with self.assertRaisesRegex(RuntimeError, 'GitHub release request failed'):
                    release.prepare_github(remote, Path('unused'))
                create.assert_not_called()

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
