"""Подготовка и доставка CLI. Запускается только в окружении сборки, не на машине пользователя."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlsplit
import zipfile

TARGETS = ('macos-arm64', 'macos-x64', 'windows-x64', 'jvm')
VERSION = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)')


def version(value):
    if not VERSION.fullmatch(value):
        raise ValueError('Version must be X.Y.Z without leading zeros')
    return value


def tag_version(tag):
    if not tag.startswith('cli-v'):
        raise ValueError('Tag must be cli-vX.Y.Z')
    return version(tag[5:])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, separators=(',', ':')) + '\n').encode()


def validate_archive(path, target):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        roots = {name.split('/')[0] for name in names}
        if len(roots) != 1:
            raise ValueError(f'{path.name}: expected one root')
        root = roots.pop()
        if not re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9._-]*', root):
            raise ValueError('Invalid archive root')
        if target != 'jvm' and root != f'dsbuilder-cli-{target}':
            raise ValueError('Unexpected native archive root')
        for entry in archive.infolist():
            if (not entry.filename.startswith(root + '/') or
                    not re.fullmatch(r'[A-Za-z0-9_./-]+', entry.filename) or
                    any(part in ('.', '..') for part in entry.filename.split('/')) or
                    (entry.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError('Unsafe archive entry')
        required = ['install.ps1', 'dsbuilder.exe'] if target == 'windows-x64' else [
            'install.sh', 'install-unix-common.sh', 'bin/dsbuilder' if target == 'jvm' else 'dsbuilder',
        ]
        for name in required:
            entry = archive.getinfo(f'{root}/{name}')
            if entry.is_dir():
                raise ValueError(f'Expected file: {name}')
            if name in ('install.sh', 'bin/dsbuilder', 'dsbuilder') and not (entry.external_attr >> 16) & 0o111:
                raise ValueError(f'Executable permission missing: {name}')
        if target == 'jvm' and not any(n.startswith(root + '/lib/') and n.endswith('.jar') for n in names):
            raise ValueError('JVM libraries missing')


def prepare(directory, release_version, base_url, bootstrap):
    version(release_version)
    url = urlsplit(base_url)
    if (url.scheme != 'https' or not url.netloc or url.username or url.password or url.query or url.fragment or
            not re.fullmatch(r'https://[A-Za-z0-9.:/~-]+', base_url)):
        raise ValueError('Public download base must be an HTTPS URL without credentials/query/fragment')
    artifacts = {}
    checksums = []
    for target in TARGETS:
        name = f'dsbuilder-cli-{target}.zip'
        path = directory / name
        validate_archive(path, target)
        sha = digest(path.read_bytes())
        artifacts[target] = {'file': name, 'sha256': sha}
        checksums.append(f'{sha}  {name}\n')
    (directory / 'release.json').write_bytes(json_bytes({
        'schemaVersion': 1, 'version': release_version, 'artifacts': artifacts,
    }))
    (directory / 'SHA256SUMS').write_text(''.join(checksums))
    for name in ('install.sh', 'install.ps1'):
        template = (bootstrap / name).read_text()
        if template.count('@CLI_DOWNLOAD_BASE_URL@') != 1:
            raise ValueError('Expected one download URL placeholder')
        (directory / name).write_text(template.replace('@CLI_DOWNLOAD_BASE_URL@', base_url.rstrip('/')))


class S3Store:
    """Адаптер s3cmd с теми же endpoint и подписью v2, что у публикации клиента."""

    def __init__(self):
        required = ('AWS_ENDPOINT', 'AWS_S3_BUCKET_2', 'AWS_REGION', 'AWS_ACCESS_KEY_ID',
                    'AWS_SECRET_ACCESS_KEY', 'CLI_S3_PREFIX')
        if any(not os.environ.get(key) for key in required):
            raise ValueError('Required AWS secrets or CLI_S3_PREFIX are missing')
        prefix = os.environ['CLI_S3_PREFIX'].strip('/')
        if not prefix or any(p in ('.', '..') for p in prefix.split('/')) or not re.fullmatch(r'[A-Za-z0-9_/-]+', prefix):
            raise ValueError('Invalid CLI_S3_PREFIX')
        bucket = os.environ['AWS_S3_BUCKET_2']
        if not re.fullmatch(r'[A-Za-z0-9.-]+', bucket):
            raise ValueError('Invalid bucket')
        self.root = f's3://{bucket}/{prefix}'
        endpoint = os.environ['AWS_ENDPOINT']
        self.https = True
        if '://' in endpoint:
            parsed = urlsplit(endpoint)
            if parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
                raise ValueError('Invalid S3 endpoint')
            if parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1'):
                self.https = False
            elif parsed.scheme != 'https':
                raise ValueError('S3 endpoint must use HTTPS except loopback tests')
            endpoint = parsed.netloc
        self.endpoint = endpoint

    def run(self, command, source, destination):
        with tempfile.TemporaryDirectory(prefix='dsbuilder-s3-') as temporary:
            config = Path(temporary) / 's3cfg'
            settings = {
                'access_key': os.environ['AWS_ACCESS_KEY_ID'],
                'secret_key': os.environ['AWS_SECRET_ACCESS_KEY'],
                'host_base': self.endpoint,
                'host_bucket': self.endpoint,
                'bucket_location': os.environ['AWS_REGION'],
                'signature_v2': 'True',
                'use_https': str(self.https),
            }
            if any('\n' in value or '\r' in value for value in settings.values()):
                raise ValueError('Invalid S3 configuration')
            config.touch(mode=0o600)
            config.write_text('[default]\n' + ''.join(f'{key} = {value}\n' for key, value in settings.items()))
            return subprocess.run(['s3cmd', '--config', str(config), '--no-progress', command, source, destination],
                                  capture_output=True, text=True, check=False)

    def get(self, key):
        with tempfile.TemporaryDirectory(prefix='dsbuilder-get-') as temporary:
            output = Path(temporary) / 'object'
            result = self.run('get', self.root + '/' + key, str(output))
            if result.returncode:
                if (re.search(r'\b(404|NoSuchKey)\b', result.stderr) or
                        result.stderr.strip() == f"ERROR: Parameter problem: Source object '{self.root}/{key}' does not exist."):
                    return None
                raise RuntimeError('S3 read failed (authorization, transport or storage error)')
            return output.read_bytes()

    def put(self, key, data):
        with tempfile.TemporaryDirectory(prefix='dsbuilder-put-') as temporary:
            source = Path(temporary) / key.rsplit('/', 1)[-1]
            source.write_bytes(data)
            result = self.run('put', str(source), self.root + '/' + key)
            if result.returncode:
                raise RuntimeError('S3 write failed')


def release_files(directory):
    return {name: (directory / name).read_bytes() for name in [
        *(f'dsbuilder-cli-{target}.zip' for target in TARGETS), 'SHA256SUMS', 'release.json',
    ]}


def upload(store, directory, release_version):
    """Проверяет конфликты до записи; повторный запуск дополняет незавершённый выпуск."""
    files = release_files(directory)
    prefix = f'releases/{version(release_version)}/'
    existing = {name: store.get(prefix + name) for name in files}
    for name, data in existing.items():
        if data is not None and data != files[name]:
            raise ValueError(f'Immutable release conflict: {name}')
    for name, data in files.items():
        if existing[name] is None:
            store.put(prefix + name, data)
        if store.get(prefix + name) != data:
            raise RuntimeError(f'Remote verification failed: {name}')


def promote(store, directory, release_version):
    release_version = version(release_version)
    for name, data in release_files(directory).items():
        if store.get(f'releases/{release_version}/{name}') != data:
            raise RuntimeError('Cannot promote incomplete release')
    previous = store.get('stable.json')
    if previous is not None:
        pointer = json.loads(previous)
        if pointer.get('schemaVersion') != 1:
            raise ValueError('Invalid stable manifest')
        previous_version = version(pointer['version'])
        if tuple(map(int, previous_version.split('.'))) > tuple(map(int, release_version.split('.'))):
            print('Older release uploaded; stable pointer unchanged')
            return
    # Совместимые сетевые установщики обновляются до указателя, после проверки полного выпуска.
    for name in ('install.sh', 'install.ps1'):
        store.put(name, (directory / name).read_bytes())
    store.put('stable.json', json_bytes({'schemaVersion': 1, 'version': release_version}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['version', 'prepare', 'upload', 'promote', 'validate'])
    parser.add_argument('--tag', required=True)
    parser.add_argument('--directory', type=Path, default=Path('build/distributions'))
    args = parser.parse_args()
    release_version = tag_version(args.tag)
    if args.operation == 'version':
        print(release_version)
    elif args.operation == 'prepare':
        prepare(args.directory, release_version, os.environ['CLI_DOWNLOAD_BASE_URL'], Path(__file__).parent / 'bootstrap')
    elif args.operation == 'validate':
        for target in TARGETS:
            validate_archive(args.directory / f'dsbuilder-cli-{target}.zip', target)
    else:
        store = S3Store()
        {'upload': upload, 'promote': promote}[args.operation](store, args.directory, release_version)


if __name__ == '__main__':
    main()
