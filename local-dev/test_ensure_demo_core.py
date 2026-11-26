import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import ensure_demo_core as core


class FakeApi:
    def __init__(self, selected=None):
        self.calls = []
        self.selected = selected or []
        self.release = dict(releaseId='exact', channel='dev', platform='compose',
                            libraryId='uikit-compose', version='0.57.0', metaSha256='sha')
        self.context = dict(coreReleases=self.selected, draftId='draft', coreSelectionRevision=7)

    def request(self, path, data=None, content_type=None, method=None):
        self.calls.append((path, method, json.loads(data) if data else None))
        if path.endswith('/core-settings'):
            return {'context': self.context}
        if '/core-releases?' in path:
            return [dict(self.release, metaSha256='wrong'), self.release] if 'channel=dev' in path else []
        if path.endswith('/core-settings/compose'):
            assert method == 'PUT'
            return {}
        if path.endswith('/preview/compose'):
            return {'coreRelease': self.release, 'buildId': 'build'}
        raise AssertionError(path)


class DemoCoreTest(unittest.TestCase):
    def setUp(self):
        self.find = patch.object(core, 'find_demo', return_value=('project', 'system'))
        self.find.start()
        self.addCleanup(self.find.stop)
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.archive = Path(self.directory.name) / 'preview.zip'
        manifest = dict(coreRelease=dict(libraryId='uikit-compose', platform='compose', version='0.57.0'),
                        apiMetaSha256='sha')
        with zipfile.ZipFile(self.archive, 'w') as z:
            z.writestr('preview-plugin.json', json.dumps(manifest))

    def test_empty_or_migrated_draft_selects_exact_archive_core_and_checks_preview(self):
        for selected in ([], [dict(platform='compose', releaseId='legacy', provenance='migration-snapshot')]):
            api = FakeApi(selected)
            core.ensure(api, self.archive)
            writes = [call for call in api.calls if call[1] == 'PUT']
            self.assertEqual([('/api/projects/project/design-systems/system/core-settings/compose', 'PUT',
                               dict(channel='dev', releaseId='exact', expectedDraftId='draft',
                                    expectedCoreSelectionRevision=7))], writes)
            self.assertTrue(api.calls[-1][0].endswith('/preview/compose'))
            self.assertFalse(any('versions' in path or 'components' in path for path, _, _ in api.calls))

    def test_repeated_setup_preserves_explicit_core_without_reading_archive(self):
        api = FakeApi([dict(platform='compose', releaseId='custom', provenance='imported')])
        core.ensure(api, Path('/missing'))
        self.assertEqual(1, len(api.calls))

    def test_missing_demo_is_skipped_without_creating_one(self):
        with patch.object(core, 'find_demo', return_value=None):
            api = FakeApi()
            core.ensure(api, Path('/missing'))
            self.assertEqual([], api.calls)

    def test_unregistered_archive_does_not_change_selection(self):
        api = FakeApi()
        api.release['metaSha256'] = 'different'
        with self.assertRaisesRegex(ValueError, 'not registered'):
            core.ensure(api, self.archive)
        self.assertFalse(any(method == 'PUT' for _, method, _ in api.calls))

    def test_ambiguous_selection_is_not_changed(self):
        api = FakeApi([dict(platform='compose')] * 2)
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            core.ensure(api, self.archive)
        self.assertEqual(1, len(api.calls))

    def test_failed_selection_is_not_retried_or_hidden(self):
        api = FakeApi()
        request = api.request
        def failed(path, *args, **kwargs):
            if kwargs.get('method') == 'PUT':
                raise RuntimeError('revision conflict')
            return request(path, *args, **kwargs)
        api.request = failed
        with self.assertRaisesRegex(RuntimeError, 'revision conflict'):
            core.ensure(api, self.archive)

    def test_setup_runs_core_step_after_publication_before_seed_and_honors_skips(self):
        for flags, expected in (([], True), (['--skip-plugin'], False),
                                (['--skip-design-system'], False), (['--backend-only'], False), (['--down'], False)):
            with self.subTest(flags=flags), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                shutil.copy2(Path(__file__).resolve().parents[1] / 'setup-local.sh', root / 'setup-local.sh')
                for name in ('docker', 'backend-kt/start-local.sh', 'backend-kt/bootstrap-base.sh',
                             'publish-preview-plugin.sh', 'ensure-local-preview-core.sh',
                             'seed-local-design-system.sh', 'publish-local-documentation.sh'):
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(f'#!/bin/sh\necho "{name} $*" >> "$SETUP_TEST_LOG"\n')
                    target.chmod(0o755)
                publisher = root / 'publish-preview-plugin.sh'
                with publisher.open('a') as f:
                    f.write('echo changed > "$SETUP_TEST_ORIGINAL_ARCHIVE"\n')
                helper = root / 'ensure-local-preview-core.sh'
                with helper.open('a') as f:
                    f.write('cat "$2" > "$SETUP_TEST_CORE_CONTENT"\n')
                (root / 'package').mkdir()
                (root / 'package/meta.json').write_text('{}')
                archive = root / 'preview.zip'
                archive.write_bytes(b'stub archive')
                env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                           SETUP_TEST_LOG=str(root / 'events'), SETUP_TEST_ORIGINAL_ARCHIVE=str(archive),
                           SETUP_TEST_CORE_CONTENT=str(root / 'content'), COMPOSE_COMPONENTS_PACKAGE='',
                           COMPOSE_PREVIEW_PLUGIN_ZIP='', WEB_PREVIEW_PLUGIN_ZIP='', LOCAL_ICONS_SOURCE='',
                           DSBUILDER_WEB_API_META='')
                result = subprocess.run(['bash', str(root / 'setup-local.sh'), '--skip-icons',
                                         '--components-package', str(root / 'package'),
                                         '--plugin-zip', str(archive), *flags],
                                        cwd=root, env=env, capture_output=True, text=True)
                self.assertEqual(0, result.returncode, result.stderr)
                events = (root / 'events').read_text().splitlines()
                steps = [i for i, x in enumerate(events) if x.startswith('ensure-local-preview-core.sh')]
                self.assertEqual(int(expected), len(steps))
                if expected:
                    publication = next(i for i, x in enumerate(events) if x.startswith('publish-preview-plugin.sh'))
                    seed = next(i for i, x in enumerate(events) if x.startswith('seed-local-design-system.sh'))
                    self.assertLess(publication, steps[0])
                    self.assertLess(steps[0], seed)
                    source = events[steps[0]].split(' --archive ', 1)[1]
                    self.assertNotEqual(str(archive), source)
                    self.assertIn('--from ' + source, events[publication])
                    self.assertEqual('stub archive', (root / 'content').read_text())


if __name__ == '__main__':
    unittest.main()
