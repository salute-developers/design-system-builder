import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
log = Path(os.environ['SEED_TEST_LOG'])
def record(value):
    with log.open('a') as out: out.write(json.dumps(value) + '\n')
if Path(sys.argv[0]).name == 'cli':
    assert os.environ['DSBUILDER_API_KEY'] == 'test-pat-secret'
    assert args[:2] == ['components', 'push']
    assert '--project-key-env' not in args and '--apply' in args
    assert '?version=draft&platform=compose' in args[args.index('--design-system') + 1]
    record({'cli': args})
    print('Status: imported')
    sys.exit(3 if os.environ['SEED_TEST_CASE'] == 'push_failure' else 0)
method = args[args.index('--request') + 1]
url = next(x for x in args if x.startswith('http://seed.test'))
path = url.removeprefix('http://seed.test')
headers = [args[n + 1] for n, x in enumerate(args) if x == '--header']
if path != '/auth/token': assert 'Authorization: Bearer ' + os.environ['SEED_TEST_SESSION'] in headers
body = args[args.index('--data') + 1] if '--data' in args else None
record({'method': method, 'path': path, 'body': body})
if path == '/auth/token': result = {'access_token': os.environ['SEED_TEST_SESSION']}
elif path == '/api/projects': result = [{'id': 'project', 'ownerUserId': 'owner'}]
elif path == '/api/projects/project': result = {'name': 'local'}
elif path == '/api/projects/project/design-systems': result = [{'id': 'ds', 'name': 'sdds_serv_local'}]
elif path == '/api/projects/project/design-systems/ds/tenants': result = [{'id': 'tenant'}]
elif path.startswith('/api/projects/project/design-systems/ds/versions?'):
    version = path.split('version=')[1].split('&')[0]
    result = [{'id': 'published-id', 'version': version}] if os.environ['SEED_TEST_CASE'] == 'existing' else []
elif path == '/api/projects/project/design-systems/ds?version=draft':
    assert any('cli' in json.loads(line) for line in log.read_text().splitlines())
    result = {'draftId': 'draft-id', 'draftRevision': 42}
elif path == '/api/projects/project/design-systems/ds/versions':
    assert method == 'POST'
    expected = os.environ.get('SEED_TEST_VERSION', '0.1.0')
    assert json.loads(body) == {'draftId': 'draft-id', 'draftRevision': 42, 'version': expected, 'changelog': 'Local setup seed'}
    import uuid
    uuid.UUID(next(h.removeprefix('Idempotency-Key: ') for h in headers if h.startswith('Idempotency-Key: ')))
    if os.environ['SEED_TEST_CASE'] == 'publish_failure': sys.exit(22)
    result = {'id': 'published-id', 'version': expected}
elif path == '/api/settings/personal-access-tokens':
    assert method == 'POST'
    assert json.loads(body) == {'name': 'local setup components push', 'scopes': ['components:write'], 'ttlSeconds': 3600}
    if os.environ['SEED_TEST_CASE'] == 'issue_failure': sys.exit(22)
    result = {'token': {'id': 'pat-id'}, 'secret': 'test-pat-secret'}
    if os.environ['SEED_TEST_CASE'] == 'missing_secret': del result['secret']
elif path == '/api/settings/personal-access-tokens/pat-id':
    assert method == 'DELETE'
    result = {}
else: raise AssertionError((method, path))
print(json.dumps(result))
'''

class SeedPatTest(unittest.TestCase):
    def run_seed(self, case, version=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'meta.json').write_text('{}')
            for name in ('curl', 'cli'):
                file = root / name
                file.write_text(FAKE)
                file.chmod(0o755)
            payload = base64.urlsafe_b64encode(b'{"sub":"owner"}').decode().rstrip('=')
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       SEED_TEST_LOG=str(root / 'events'), SEED_TEST_CASE=case,
                       SEED_TEST_SESSION='header.' + payload + '.signature')
            if version is not None: env['SEED_TEST_VERSION'] = version
            result = subprocess.run(['bash', str(ROOT / 'seed-local-design-system.sh'),
                '--package', str(root), '--theme-package', '', '--gateway-url', 'http://seed.test',
                '--cli', str(root / 'cli')] + (['--publish-version', version] if version is not None else []), env=env, capture_output=True, text=True)
            events = [json.loads(line) for line in (root / 'events').read_text().splitlines()]
            self.assertNotIn('test-pat-secret', result.stdout + result.stderr)
            return result, events

    def test_success_revokes_pat(self):
        result, events = self.run_seed('success')
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(any('cli' in event for event in events))
        self.assertEqual('/api/projects/project/design-systems/ds/versions', events[-2]['path'])
        self.assertEqual('DELETE', events[-1]['method'])
        self.assertEqual('/api/settings/personal-access-tokens/pat-id', events[-1]['path'])

    def test_push_failure_still_revokes_pat(self):
        result, events = self.run_seed('push_failure')
        self.assertNotEqual(0, result.returncode)
        self.assertEqual('DELETE', events[-1]['method'])
        self.assertIn('could not be loaded', result.stderr)

    def test_issue_failure_does_not_run_cli(self):
        result, events = self.run_seed('issue_failure')
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any('cli' in event for event in events))
        self.assertIn('Could not create a temporary PAT', result.stderr)

    def test_incomplete_response_still_revokes_pat(self):
        result, events = self.run_seed('missing_secret')
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any('cli' in event for event in events))
        self.assertEqual('DELETE', events[-1]['method'])

    def test_existing_version_updates_draft_without_republishing(self):
        result, events = self.run_seed('existing')
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(any('cli' in event for event in events))
        self.assertFalse(any(event.get('path', '').endswith('/versions') for event in events))
        self.assertIn('already published and unchanged', result.stdout)

    def test_explicit_version_is_published(self):
        result, events = self.run_seed('success', '0.1.1')
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual('0.1.1', json.loads(events[-2]['body'])['version'])

    def test_publish_failure_fails_and_revokes_pat_without_retry(self):
        result, events = self.run_seed('publish_failure')
        self.assertNotEqual(0, result.returncode)
        self.assertEqual(1, sum(event.get('path', '').endswith('/versions') for event in events))
        self.assertEqual('DELETE', events[-1]['method'])
        self.assertIn('remains in the draft', result.stderr)

    def test_invalid_version_fails_before_api_calls(self):
        result = subprocess.run(['bash', str(ROOT / 'seed-local-design-system.sh'),
            '--publish-version', '01.2.3'], capture_output=True, text=True)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('--publish-version must', result.stderr)

    def test_setup_requires_seed_for_explicit_version(self):
        result = subprocess.run(['bash', str(ROOT / 'setup-local.sh'),
            '--publish-version', '0.1.1'], capture_output=True, text=True)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('require --components-package', result.stderr)

if __name__ == '__main__': unittest.main()
