"""Внутренний сценарий Docker-клиента; запускать через run_s3_integration.py."""
import json
import os
from pathlib import Path
import tempfile
import uuid
import subprocess
import time
import urllib.error
import urllib.request

from test_release import DIST, make_archive, release


def main():
    # Всегда тестовый loopback: внешние AWS_* не используются даже при прямом запуске.
    os.environ.update(
        AWS_ENDPOINT='http://127.0.0.1:9000', AWS_S3_BUCKET_2='cli-test', AWS_REGION='us-east-1',
        AWS_ACCESS_KEY_ID='cli-test-user', AWS_SECRET_ACCESS_KEY='cli-test-password',
        CLI_S3_PREFIX='cli-test-' + uuid.uuid4().hex,
    )
    deadline = time.monotonic() + 60
    while True:
        try:
            with urllib.request.urlopen('http://127.0.0.1:9000/minio/health/live', timeout=2) as response:
                if response.status == 200:
                    break
        except (OSError, urllib.error.URLError):
            pass
        if time.monotonic() >= deadline:
            raise RuntimeError('MinIO readiness timeout (60 seconds)')
        time.sleep(0.2)
    with tempfile.TemporaryDirectory(prefix='cli-s3-bootstrap-') as temporary:
        config = Path(temporary) / 's3cfg'
        config.touch(mode=0o600)
        config.write_text(
            '[default]\naccess_key = cli-test-user\nsecret_key = cli-test-password\n'
            'host_base = 127.0.0.1:9000\nhost_bucket = 127.0.0.1:9000\n'
            'bucket_location = us-east-1\nsignature_v2 = True\nuse_https = False\n'
        )
        subprocess.run(['s3cmd', '--config', str(config), 'mb', 's3://cli-test'], check=True)
    store = release.S3Store()
    with tempfile.TemporaryDirectory(prefix='cli-s3-test-') as temporary:
        directory = Path(temporary)
        for target in release.TARGETS:
            make_archive(directory, target)
        release.prepare(directory, '1.2.3', 'https://example.invalid/cli', DIST / 'bootstrap')
        store.put('stable.json', release.json_bytes({'schemaVersion': 1, 'version': '1.0.0'}))
        original_put = store.put

        def interrupted(key, data):
            if key.endswith('windows-x64.zip'):
                raise RuntimeError('Test interruption')
            original_put(key, data)

        store.put = interrupted
        try:
            release.upload(store, directory, '1.2.3')
        except RuntimeError:
            pass
        else:
            raise AssertionError('Interruption was not exercised')
        assert json.loads(store.get('stable.json'))['version'] == '1.0.0'
        store.put = original_put
        release.upload(store, directory, '1.2.3')
        release.upload(store, directory, '1.2.3')
        release.promote(store, directory, '1.2.3')
        assert json.loads(store.get('stable.json'))['version'] == '1.2.3'
        archive = directory / 'dsbuilder-cli-jvm.zip'
        original = archive.read_bytes()
        archive.write_bytes(b'conflict')
        try:
            release.upload(store, directory, '1.2.3')
        except ValueError:
            pass
        else:
            raise AssertionError('Immutable conflict was not rejected')
        archive.write_bytes(original)
        store.put('stable.json', release.json_bytes({'schemaVersion': 1, 'version': '1.10.0'}))
        release.promote(store, directory, '1.2.3')
        assert json.loads(store.get('stable.json'))['version'] == '1.10.0'
        print('S3 integration passed: v2 signature, interrupted upload, retry, conflict, verification, no downgrade')


if __name__ == '__main__':
    main()
