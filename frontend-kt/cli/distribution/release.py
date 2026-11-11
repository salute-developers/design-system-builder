"""Подготовка и доставка CLI. Запускается только в окружении сборки, не на машине пользователя."""

import argparse
import hashlib
from io import BytesIO
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
IOS_TAG = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]*')


def version(value):
    if not isinstance(value, str) or not VERSION.fullmatch(value):
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


def validate_ios_archive(data):
    with zipfile.ZipFile(BytesIO(data)) as ios:
        for entry in ios.infolist():
            if (not entry.filename.startswith('dsbuilder-ios-cli/') or
                    not re.fullmatch(r'[A-Za-z0-9_./-]+', entry.filename) or
                    any(part in ('.', '..') for part in entry.filename.split('/')) or
                    (entry.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError('Unsafe iOS CLI archive entry')
        for name in ('dsbuilder-ios', 'ios-api-meta.json'):
            entry = ios.getinfo(f'dsbuilder-ios-cli/{name}')
            if entry.is_dir():
                raise ValueError(f'iOS CLI archive has no {name}')
        if ios.testzip() is not None:
            raise ValueError('Corrupt iOS CLI archive')


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
        if target == 'macos-arm64':
            if f'{root}/ios-release.txt' not in names:
                raise ValueError('macOS arm64 release distribution is missing its bundled iOS CLI')
            tag = archive.read(f'{root}/ios-release.txt').decode('ascii').strip()
            if not IOS_TAG.fullmatch(tag) or tag == 'current':
                raise ValueError('Invalid bundled iOS CLI release tag')
            name = f'{root}/ios/dsbuilder-ios-cli-{tag}.zip'
            if name not in names:
                raise ValueError('macOS arm64 release distribution is missing its bundled iOS CLI archive')
            entry = archive.getinfo(name)
            if entry.is_dir() or entry.file_size > 100_000_000:
                raise ValueError('Invalid bundled iOS CLI archive')
            validate_ios_archive(archive.read(name))
        elif any(name == f'{root}/ios-release.txt' or name.startswith(f'{root}/ios/') for name in names):
            raise ValueError('iOS CLI is only supported in the macOS arm64 distribution')
        return tag if target == 'macos-arm64' else None


def github_repository():
    repository = os.environ.get('GITHUB_REPOSITORY', 'salute-developers/design-system-builder')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid GitHub repository')
    return repository


def prepare(directory, release_version, bootstrap):
    version(release_version)
    release_base = 'https://github.com/' + github_repository()
    artifacts = {}
    checksums = []
    ios_tag = None
    for target in TARGETS:
        name = f'dsbuilder-cli-{target}.zip'
        path = directory / name
        bundled_ios_tag = validate_archive(path, target)
        if target == 'macos-arm64':
            ios_tag = bundled_ios_tag
        sha = digest(path.read_bytes())
        artifacts[target] = {'file': name, 'sha256': sha}
        checksums.append(f'{sha}  {name}\n')
    (directory / 'release.json').write_bytes(json_bytes({
        'schemaVersion': 1, 'version': release_version, 'iosCliReleaseTag': ios_tag, 'artifacts': artifacts,
    }))
    (directory / 'SHA256SUMS').write_text(''.join(checksums))
    for name in ('install.sh', 'install.ps1'):
        template = (bootstrap / name).read_text()
        if template.count('@CLI_RELEASE_BASE_URL@') != 1:
            raise ValueError('Expected one download URL placeholder')
        (directory / name).write_text(template.replace('@CLI_RELEASE_BASE_URL@', release_base))


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


def verified_remote_release(store, release_version):
    prefix = ''
    version(release_version)
    manifest_data = store.get(prefix + 'release.json')
    if manifest_data is None:
        raise RuntimeError('Release manifest is missing in GitHub')
    manifest = json.loads(manifest_data, object_pairs_hook=unique_object)
    if (not isinstance(manifest, dict) or type(manifest.get('schemaVersion')) is not int or manifest['schemaVersion'] != 1 or
            manifest.get('version') != release_version):
        raise ValueError('Release manifest does not match version')
    if not isinstance(manifest.get('artifacts'), dict) or set(manifest['artifacts']) != set(TARGETS):
        raise ValueError('Release manifest has wrong targets')
    ios_tag = manifest.get('iosCliReleaseTag')
    if not isinstance(ios_tag, str) or not IOS_TAG.fullmatch(ios_tag) or ios_tag == 'current':
        raise ValueError('Release manifest has an invalid iOS CLI tag')
    checksums = []
    for target in TARGETS:
        name = f'dsbuilder-cli-{target}.zip'
        data = store.get(prefix + name)
        if data is None:
            raise RuntimeError(f'Release archive is missing: {name}')
        sha = digest(data)
        if manifest['artifacts'][target] != {'file': name, 'sha256': sha}:
            raise ValueError(f'Release checksum mismatch: {name}')
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / name
            path.write_bytes(data)
            archived_tag = validate_archive(path, target)
        if target == 'macos-arm64':
            if archived_tag != ios_tag:
                raise ValueError('Release iOS CLI tag does not match the archive')
        checksums.append(f'{sha}  {name}\n')
    if store.get(prefix + 'SHA256SUMS') != ''.join(checksums).encode():
        raise ValueError('Release SHA256SUMS mismatch')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result


class GitHubRelease:
    """Работа с публичным выпуском через gh; токен нужен только окружению CI."""

    def __init__(self, tag):
        tag_version(tag)
        self.tag = tag
        self.repo = github_repository()

    def run(self, *args):
        return subprocess.run(['gh', *args], capture_output=True, check=True)

    def info(self, suffix):
        try:
            return json.loads(self.run('api', f'repos/{self.repo}/releases/{suffix}').stdout)
        except subprocess.CalledProcessError as error:
            if b'(HTTP 404)' in error.stderr:
                return None
            raise RuntimeError('GitHub release request failed') from error

    def view(self):
        return self.info('tags/' + self.tag)

    def latest(self):
        return self.info('latest')

    def create(self):
        self.run('release', 'create', self.tag, '--repo', self.repo, '--verify-tag', '--draft',
                 '--title', 'DS Builder CLI ' + tag_version(self.tag), '--notes', 'DS Builder CLI distributions.')

    def get(self, key):
        info = self.view()
        assets = [a for a in info['assets'] if a['name'] == key] if info else []
        if len(assets) != 1:
            raise RuntimeError('Missing or duplicate release asset: ' + key)
        with tempfile.TemporaryDirectory() as temporary:
            self.run('release', 'download', self.tag, '--repo', self.repo, '--pattern', key, '--dir', temporary)
            return (Path(temporary) / key).read_bytes()

    def upload(self, directory):
        self.run('release', 'upload', self.tag, '--repo', self.repo, '--clobber',
                 *(str(directory / name) for name in release_files(directory)))

    def publish(self, latest):
        self.run('release', 'edit', self.tag, '--repo', self.repo, '--draft=false',
                 '--latest=' + str(latest).lower())


def upload_installers(store, directory):
    """Перезаписывает только два постоянных S3-ключа с проверкой байтов."""
    for name in ('install.sh', 'install.ps1'):
        data = (directory / name).read_bytes()
        store.put(name, data)
        if store.get(name) != data:
            raise RuntimeError('Installer verification failed: ' + name)


def prepare_github(remote, directory):
    info = remote.view()
    if info and info.get('prerelease'):
        raise ValueError('CLI release must not be a prerelease')
    published = info is not None and not info['draft']
    if not published:
        if info is None:
            remote.create()
        remote.upload(directory)
    verified_remote_release(remote, tag_version(remote.tag))
    return published


def promote_github(remote):
    info = remote.view()
    if not info or info.get('prerelease'):
        raise ValueError('Select a complete stable release')
    verified_remote_release(remote, tag_version(remote.tag))
    latest = remote.latest()
    if latest:
        latest_version = tag_version(latest['tag_name'])
    newer = latest is None or tuple(map(int, tag_version(remote.tag).split('.'))) > tuple(map(int, latest_version.split('.')))
    if info['draft']:
        remote.publish(newer)
    # Повтор опубликованного тега не меняет Latest.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['version', 'prepare', 'upload', 'promote', 'validate',
                                             'upload-installers'])
    parser.add_argument('--tag', required=True)
    parser.add_argument('--directory', type=Path, default=Path('build/distributions'))
    args = parser.parse_args()
    release_version = tag_version(args.tag)
    if args.operation == 'version':
        print(release_version)
    elif args.operation == 'prepare':
        prepare(args.directory, release_version, Path(__file__).parent / 'bootstrap')
    elif args.operation == 'validate':
        for target in TARGETS:
            validate_archive(args.directory / f'dsbuilder-cli-{target}.zip', target)
    elif args.operation == 'upload-installers':
        upload_installers(S3Store(), args.directory)
    elif args.operation == 'upload':
        prepare_github(GitHubRelease(args.tag), args.directory)
    else:
        promote_github(GitHubRelease(args.tag))


if __name__ == '__main__':
    main()
