"""Публикует проверенные npm-архивы без пересборки, с безопасным повтором версии."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import urlopen

PACKAGES = {
    'generator': '@sddsjs/design-system-builder-generator',
    'cli': '@sddsjs/design-system-builder-cli',
}
VERSION = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)')


def archive_info(archive, kind, tag):
    if not re.fullmatch(r'cli-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', tag):
        raise ValueError('Expected a stable cli-vX.Y.Z release tag')
    with tarfile.open(archive, 'r:gz') as packed:
        entries = packed.getmembers()
        names = [entry.name for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate npm archive entry')
        for entry in entries:
            parts = entry.name.split('/')
            if (not entry.name.startswith('package/') or '..' in parts or
                    any(part in ('.env', '.sdds', '.npmrc', 'node_modules') for part in parts) or
                    not (entry.isfile() or entry.isdir())):
                raise ValueError('Unsafe npm archive entry')
        manifest = json.load(packed.extractfile('package/package.json'))
    version = manifest.get('version', '')
    if (manifest.get('name') != PACKAGES[kind] or not VERSION.fullmatch(version) or
            manifest.get('publishConfig', {}).get('access') != 'public' or manifest.get('private') is True):
        raise ValueError('Package name, version or public access does not match')
    if kind == 'cli' and version != tag.removeprefix('cli-v'):
        raise ValueError('CLI npm version does not match the release tag')
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(Path(archive).read_bytes()).digest()).decode()
    return manifest['name'], version, integrity


def validate_registry(registry):
    url = urlsplit(registry)
    if (url.username or url.password or url.query or url.fragment or
            not (url.scheme == 'https' or (url.scheme == 'http' and url.hostname in ('127.0.0.1', 'localhost')))):
        raise ValueError('Expected an HTTPS registry or a loopback test registry')


def metadata(registry, name):
    validate_registry(registry)
    try:
        with urlopen(registry.rstrip('/') + '/' + quote(name, safe='@'), timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        status = error.code
        error.close()
        if status == 404:
            return {'versions': {}, 'dist-tags': {}}
        raise RuntimeError(f'Cannot read npm metadata: HTTP {status}') from None


def publication_state(archive, kind, tag, registry):
    name, version, integrity = archive_info(archive, kind, tag)
    current = metadata(registry, name)
    existing = current.get('versions', {}).get(version)
    if existing is not None:
        if existing.get('dist', {}).get('integrity') != integrity:
            raise ValueError(f'Already published with different content: {name}@{version}')
        return name, version, integrity, True
    latest = current.get('dist-tags', {}).get('latest')
    if latest:
        if not VERSION.fullmatch(latest):
            raise ValueError(f'Unexpected latest version for {name}')
        if tuple(map(int, version.split('.'))) <= tuple(map(int, latest.split('.'))):
            raise ValueError(f'Refusing to lower npm latest: {name}@{version}')
    return name, version, integrity, False


def npm_command(args):
    if os.name != 'nt':
        return ['npm', *args]
    if any(any(char in value for char in '\"%^!\r\n') for value in args):
        raise ValueError('Unsupported Windows npm argument')
    executable = os.environ.get('ComSpec', r'C:\Windows\System32\cmd.exe')
    tokens = ' '.join('"' + value + '"' for value in ['npm.cmd', *args])
    return [executable, '/d', '/v:off', '/s', '/c', '"' + tokens + '"']


def publish(archive, kind, tag, registry):
    name, version, integrity, exists = publication_state(archive, kind, tag, registry)
    if exists:
        print(f'Verified existing npm package: {name}@{version}')
        return
    if not os.environ.get('NODE_AUTH_TOKEN'):
        raise ValueError('NODE_AUTH_TOKEN is required for npm publication')
    with tempfile.TemporaryDirectory(prefix='dsbuilder-npm-auth-') as temporary:
        config = Path(temporary) / '.npmrc'
        auth_path = registry.split('://', 1)[1].rstrip('/') + '/'
        config.write_text('//' + auth_path + ':_authToken=${NODE_AUTH_TOKEN}\n')
        config.chmod(0o600)
        try:
            result = subprocess.run(npm_command([
                'publish', str(Path(archive).resolve()), '--access', 'public', '--ignore-scripts',
                '--tag', 'latest', '--registry', registry, '--userconfig', str(config),
            ]), capture_output=True, timeout=180, check=False)
            exit_code = result.returncode
        except subprocess.TimeoutExpired:
            # npm can time out after the registry has already accepted the archive.
            exit_code = 'timeout'
    # A lost response can follow a successful write. Verify the exact immutable archive.
    state = publication_state(archive, kind, tag, registry)
    if not state[3]:
        raise RuntimeError(f'npm publication was not confirmed: {name}@{version} (exit {exit_code})')
    print(f'Verified npm publication: {name}@{version} ({integrity})')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('version', 'preflight', 'publish'))
    parser.add_argument('--kind', choices=PACKAGES, required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--registry', default='https://registry.npmjs.org')
    args = parser.parse_args()
    if args.operation == 'version':
        print(archive_info(args.archive, args.kind, args.tag)[1])
    elif args.operation == 'preflight':
        state = publication_state(args.archive, args.kind, args.tag, args.registry)
        print(f'Verified npm input: {state[0]}@{state[1]}')
    else:
        publish(args.archive, args.kind, args.tag, args.registry)


if __name__ == '__main__':
    main()
