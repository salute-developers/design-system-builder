import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import unquote

DIST = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('npm_release', DIST / 'npm_release.py')
npm_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(npm_release)


class Registry(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, status, body, content_type='application/json'):
        data = json.dumps(body).encode() if isinstance(body, dict) else body
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        name = unquote(self.path).lstrip('/')
        if '/-/' in name:
            archive = self.server.archives.get(name)
            return self.respond(200, archive, 'application/octet-stream') if archive else self.respond(404, {})
        return self.respond(200, self.server.packages[name]) if name in self.server.packages else self.respond(404, {})

    def do_PUT(self):
        if self.headers.get('Authorization') != 'Bearer test-only':
            return self.respond(403, {'error': 'forbidden'})
        package = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        name = package['name']
        if name == self.server.fail_package:
            return self.respond(403, {'error': 'test failure'})
        self.server.writes.append(name)
        for version in package['versions'].values():
            url = version['dist']['tarball']
            key = unquote(url.split(self.server.registry + '/', 1)[1])
            attachment = next(iter(package['_attachments'].values()))
            self.server.archives[key] = base64.b64decode(attachment['data'])
        self.server.packages[name] = package
        self.respond(201, {'ok': True, 'id': name, 'rev': '1'})


class NpmReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Registry)
        self.server.registry = f'http://127.0.0.1:{self.server.server_port}'
        self.server.packages = {}
        self.server.archives = {}
        self.server.writes = []
        self.server.fail_package = None
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.auth = patch.dict(os.environ, {'NODE_AUTH_TOKEN': 'test-only'})
        self.auth.start()
        self.addCleanup(self.auth.stop)

    def stop(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def archive(self, kind, version, suffix=''):
        command = 'dsbuilder' if kind == 'cli' else 'dsbuilder-web-generator'
        manifest = {'name': npm_release.PACKAGES[kind], 'version': version, 'publishConfig': {'access': 'public'},
                    'bin': {command: 'bin/cli.js'}}
        output = f'dsbuilder version {version}' if kind == 'cli' else version
        files = {'package.json': json.dumps(manifest).encode(),
                 'bin/cli.js': f'#!/usr/bin/env node\nconsole.log("{output}{suffix}");\n'.encode()}
        archive = self.root / (kind + version + suffix + '.tgz')
        with tarfile.open(archive, 'w:gz') as packed:
            for name, data in files.items():
                entry = tarfile.TarInfo('package/' + name)
                entry.size = len(data)
                entry.mode = 0o755
                packed.addfile(entry, BytesIO(data))
        return archive

    def publish(self, archive, kind):
        npm_release.publish(archive, kind, 'cli-v1.2.3', self.server.registry)

    def test_publishes_both_and_installs_by_name_without_auth(self):
        generator = self.archive('generator', '0.2.0')
        cli = self.archive('cli', '1.2.3')
        self.publish(generator, 'generator')
        self.publish(cli, 'cli')
        self.publish(generator, 'generator')
        self.publish(cli, 'cli')
        self.assertEqual(list(npm_release.PACKAGES.values()), self.server.writes)
        env = {key: value for key, value in os.environ.items() if key not in ('NODE_AUTH_TOKEN', 'NPM_TOKEN')}
        config = self.root / 'empty.npmrc'
        config.write_text('')
        for kind, version, command in [('generator', '0.2.0', 'dsbuilder-web-generator'), ('cli', '1.2.3', 'dsbuilder')]:
            prefix = self.root / kind
            subprocess.run(npm_release.npm_command(['install', '-g', '--prefix', str(prefix), '--registry', self.server.registry,
                            '--userconfig', str(config), '--ignore-scripts', '--no-audit', '--no-fund',
                            npm_release.PACKAGES[kind] + '@' + version]), check=True, capture_output=True, env=env, timeout=60)
            binary = prefix / 'bin' / command if os.name != 'nt' else prefix / 'node_modules' / npm_release.PACKAGES[kind] / 'bin/cli.js'
            result = subprocess.run(['node', str(binary), '--version'], check=True, capture_output=True, text=True, env=env)
            self.assertIn(version, result.stdout)

    def test_timeout_after_successful_write_is_verified(self):
        archive = self.archive('cli', '1.2.3')
        run = subprocess.run

        def accepted_then_timeout(*args, **kwargs):
            run(*args, **kwargs)
            raise subprocess.TimeoutExpired(args[0], kwargs['timeout'])

        with patch.object(npm_release.subprocess, 'run', side_effect=accepted_then_timeout):
            self.publish(archive, 'cli')
        self.assertEqual([npm_release.PACKAGES['cli']], self.server.writes)

    def test_partial_failure_can_resume_without_republishing_generator(self):
        generator = self.archive('generator', '0.2.0')
        cli = self.archive('cli', '1.2.3')
        self.publish(generator, 'generator')
        self.server.fail_package = npm_release.PACKAGES['cli']
        with self.assertRaises(RuntimeError):
            self.publish(cli, 'cli')
        self.server.fail_package = None
        self.publish(generator, 'generator')
        self.publish(cli, 'cli')
        self.assertEqual(list(npm_release.PACKAGES.values()), self.server.writes)

    def test_rejects_changed_content_bad_tag_and_lower_latest_before_writing(self):
        original = self.archive('generator', '0.2.0')
        self.publish(original, 'generator')
        with self.assertRaises(ValueError):
            self.publish(self.archive('generator', '0.2.0', 'changed'), 'generator')
        with self.assertRaises(ValueError):
            self.publish(self.archive('generator', '0.1.0'), 'generator')
        with self.assertRaises(ValueError):
            self.publish(self.archive('cli', '9.9.9'), 'cli')
        with self.assertRaises(ValueError):
            npm_release.publication_state(original, 'generator', 'dev', self.server.registry)
        self.assertEqual(1, len(self.server.writes))

    def test_missing_token_stops_new_publication(self):
        with patch.dict(os.environ, {'NODE_AUTH_TOKEN': ''}), self.assertRaises(ValueError):
            self.publish(self.archive('cli', '1.2.3'), 'cli')
        self.assertFalse(self.server.writes)


if __name__ == '__main__':
    unittest.main()
