import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('select_core_release', Path(__file__).with_name('select_core_release.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExactCoreSelectionTest(unittest.TestCase):
    def test_old_explicit_id_is_found_after_first_page(self):
        visited = []
        target = {'releaseId': 'old', 'channel': 'stable'}
        def load(channel, offset, limit):
            visited.append((channel, offset))
            return [{'releaseId': str(n)} for n in range(100)] if offset == 0 else [target]
        self.assertEqual(target, module.find_release(load, release_id='old'))
        self.assertEqual([('stable', 0), ('stable', 100)], visited)

    def test_legacy_archive_channel_does_not_override_the_registered_channel(self):
        for archive_channel, registered_channel in [('dev', 'stable'), ('stable', 'dev')]:
            with self.subTest(archive_channel=archive_channel, registered_channel=registered_channel):
                target = dict(releaseId='exact', channel=registered_channel, libraryId='uikit-compose',
                              platform='compose', version='1.0-dev', metaSha256='sha')
                manifest = dict(coreRelease=dict(libraryId='uikit-compose', platform='compose', version='1.0-dev'),
                                channel=archive_channel, apiMetaSha256='sha')
                visited = []
                def load(channel, offset, limit):
                    visited.append((channel, offset))
                    if channel != registered_channel:
                        return []
                    return [dict(target, metaSha256='wrong')] * 100 if offset == 0 else [target]
                self.assertEqual(target, module.find_release(load, manifest=manifest))
                self.assertIn((registered_channel, 100), visited)

    def test_channel_free_archive_resolves_exact_registered_release(self):
        target = dict(releaseId='exact', channel='dev', libraryId='uikit-compose', platform='compose', version='1.0-dev', metaSha256='sha')
        manifest = dict(coreRelease=dict(libraryId='uikit-compose', platform='compose', version='1.0-dev'), apiMetaSha256='sha')
        def load(channel, offset, limit):
            return [target] if channel == 'dev' else []
        self.assertEqual(target, module.find_release(load, manifest=manifest))


if __name__ == '__main__':
    unittest.main()
