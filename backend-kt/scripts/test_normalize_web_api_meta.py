import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from normalize_web_api_meta import normalize


class BootstrapMetadataTest(unittest.TestCase):
    def test_conflicting_type_is_rejected_before_emitting_partial_release(self):
        source = [{'componentName': 'Button', 'params': [
            {'id': 'fill', 'type': 'color', 'paramName': 'fill'},
            {'id': 'fill', 'type': 'typography', 'paramName': 'fill'},
        ]}]
        with self.assertRaisesRegex(ValueError, 'Conflicting property types'):
            normalize(source)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'meta.json'
            path.write_text(json.dumps(source))
            result = self.run_script(path)
            self.assertNotEqual(0, result.returncode)
            self.assertEqual('', result.stdout)

    def test_empty_valid_array_keeps_exact_source_bytes_and_empty_projection(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'meta.json'
            path.write_text('[]')
            result = self.run_script(path)
            self.assertEqual(0, result.returncode, result.stderr)
            body = json.loads(result.stdout)
            self.assertEqual([], body['components'])
            self.assertEqual('W10=', body['sourceMetaBase64'])

    def test_nonempty_invalid_or_wrong_platform_input_cannot_claim_an_empty_release(self):
        for source in [[{}], [{'componentName': ''}], [{'componentName': 'Button', 'params': [
            {'id': 'fill', 'type': 'color'}]}]]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                normalize(source)

    def run_script(self, path):
        return subprocess.run(['python3', str(Path(__file__).with_name('normalize_web_api_meta.py')), str(path),
                               '--library-id', 'web-core', '--core-version', 'A', '--channel', 'stable'],
                              capture_output=True, text=True)


if __name__ == '__main__':
    unittest.main()
