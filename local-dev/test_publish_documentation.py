import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('local_docs', Path(__file__).with_name('publish_documentation.py'))
docs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(docs)


class FakeApi:
    user_id = 'owner'

    def __init__(self, present=True, active=False, failed=False):
        self.present, self.active, self.failed = present, active, failed
        self.uploads = []
        self.calls = []

    def request(self, path, data=None, content_type=None, missing_ok=False):
        self.calls.append(path)
        if path == '/api/projects':
            return [{'id': 'project', 'ownerUserId': 'owner'}, {'id': 'foreign', 'ownerUserId': 'other'}]
        if path == '/api/projects/project/design-systems':
            return [{'id': 'system', 'name': 'sdds_serv_local'}] if self.present else []
        if path.endswith('/versions?limit=1'):
            return [{'version': '0.1.2'}]
        if '/publications/active?' in path:
            return {'publicationId': 'existing' if self.active else 'new'} if self.active or self.uploads else None
        if path.endswith('/bundles'):
            self.uploads.append(data)
            self.content_type = content_type
            return {'jobId': 'job'}
        if path.endswith('/ingestion-jobs/job'):
            return {'status': 'failed' if self.failed else 'published',
                    'diagnostics': [{'level': 'error', 'code': 'invalid_bundle'}]}
        raise AssertionError(path)


class DocumentationSeedTest(unittest.TestCase):
    def bundle(self, directory, manifest=None):
        path = Path(directory) / 'docs.tar.gz'
        with tarfile.open(path, 'w:gz') as archive:
            for name, value in {'manifest.json': manifest or {'platform': 'compose',
                    'designSystem': {'id': 'template', 'version': '0.0.0'}},
                    'meta/theme-info.json': {'reference': 'SddsServTheme.colors.textDefaultPrimary'}}.items():
                data = json.dumps(value).encode()
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path

    def test_rebinds_only_manifest_and_preserves_real_code_references(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = docs.bind_bundle(self.bundle(directory), 'actual-system', '0.1.2')
            with tarfile.open(fileobj=io.BytesIO(bundle), mode='r:gz') as archive:
                self.assertEqual({'id': 'actual-system', 'version': '0.1.2'},
                                 json.load(archive.extractfile('manifest.json'))['designSystem'])
                self.assertEqual('SddsServTheme.colors.textDefaultPrimary',
                                 json.load(archive.extractfile('meta/theme-info.json'))['reference'])

    def test_missing_demo_creates_nothing_and_does_not_require_bundle(self):
        api = FakeApi(present=False)
        self.assertIsNone(docs.publish(api, Path('/missing')))
        self.assertEqual([], api.uploads)
        self.assertFalse(any('foreign/' in path for path in api.calls))

    def test_setup_preserves_existing_publication_without_reading_bundle(self):
        api = FakeApi(active=True)
        self.assertEqual('existing', docs.publish(api, Path('/missing'), if_missing=True)['publicationId'])
        self.assertEqual([], api.uploads)

    def test_upload_uses_actual_project_system_version_and_waits_for_publication(self):
        api = FakeApi()
        with tempfile.TemporaryDirectory() as directory:
            result = docs.publish(api, self.bundle(directory), if_missing=True)
        self.assertEqual('new', result['publicationId'])
        self.assertEqual(1, len(api.uploads))
        self.assertIn('multipart/form-data; boundary=', api.content_type)
        body = api.uploads[0].split(b'\r\n\r\n', 1)[1].rsplit(b'\r\n--', 1)[0]
        with tarfile.open(fileobj=io.BytesIO(body), mode='r:gz') as archive:
            self.assertEqual({'id': 'system', 'version': '0.1.2'},
                             json.load(archive.extractfile('manifest.json'))['designSystem'])
        self.assertIn('/api/projects/project/documentation/ingestion-jobs/job', api.calls)

    def test_processing_failure_is_reported_and_previous_publication_is_not_deleted(self):
        api = FakeApi(active=True, failed=True)
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, 'invalid_bundle'):
            docs.publish(api, self.bundle(directory))
        self.assertEqual(1, len(api.uploads))
        self.assertTrue(api.active)

    def test_nonlocal_url_is_rejected_before_login(self):
        with patch.object(docs.urllib.request, 'build_opener') as opener:
            with self.assertRaisesRegex(ValueError, 'local gateway'):
                docs.LocalApi('https://production.example')
            opener.assert_not_called()

    def test_ambiguous_seed_fails_instead_of_selecting_random_project(self):
        api = FakeApi()
        request = api.request

        def ambiguous(path, *args, **kwargs):
            if path.endswith('/design-systems'):
                return [{'id': 'a', 'name': 'sdds_serv_local'}, {'id': 'b', 'name': 'sdds_serv_local-project'}]
            return request(path, *args, **kwargs)

        api.request = ambiguous
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            docs.publish(api, Path('/missing'))

    def test_unsafe_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'unsafe.tar.gz'
            with tarfile.open(path, 'w:gz') as archive:
                member = tarfile.TarInfo('../manifest.json')
                member.size = 2
                archive.addfile(member, io.BytesIO(b'{}'))
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                docs.bind_bundle(path, 'system', '0.1.2')

    def run_setup(self, arguments=(), docs_status=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy2(docs.ROOT / 'setup-local.sh', root / 'setup-local.sh')
            for name in ('docker', 'backend-kt/start-local.sh', 'backend-kt/bootstrap-base.sh',
                         'seed-local-design-system.sh', 'publish-local-documentation.sh'):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                status = docs_status if name == 'publish-local-documentation.sh' else 0
                target.write_text(f'#!/bin/sh\necho "{name} $*" >> "$SETUP_TEST_LOG"\nexit {status}\n')
                target.chmod(0o755)
            (root / 'package').mkdir()
            (root / 'package/meta.json').write_text('{}')
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       SETUP_TEST_LOG=str(root / 'events'), COMPOSE_COMPONENTS_PACKAGE='',
                       COMPOSE_PREVIEW_PLUGIN_ZIP='', WEB_PREVIEW_PLUGIN_ZIP='', LOCAL_ICONS_SOURCE='')
            result = subprocess.run(['bash', str(root / 'setup-local.sh'), '--skip-plugin', '--skip-icons',
                                     *arguments], env=env, cwd=root, capture_output=True, text=True)
            events = (root / 'events').read_text().splitlines()
            return result, events

    def test_setup_calls_documentation_after_optional_seed(self):
        result, events = self.run_setup(('--components-package', 'package'))
        self.assertEqual(0, result.returncode, result.stderr)
        seed = next(i for i, event in enumerate(events) if event.startswith('seed-local-design-system.sh'))
        publication = events.index('publish-local-documentation.sh --if-missing')
        self.assertGreater(publication, seed)
        result, events = self.run_setup()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn('publish-local-documentation.sh --if-missing', events)

    def test_setup_skip_flags_and_backend_only_do_not_publish(self):
        for flag in ('--skip-documentation', '--skip-design-system', '--backend-only', '--down'):
            with self.subTest(flag=flag):
                result, events = self.run_setup((flag,))
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertFalse(any(event.startswith('publish-local-documentation.sh') for event in events))

    def test_documentation_failure_stops_setup_before_ready(self):
        result, _ = self.run_setup(docs_status=9)
        self.assertEqual(9, result.returncode)
        self.assertNotIn('Local setup is ready', result.stdout)


if __name__ == '__main__':
    unittest.main()
