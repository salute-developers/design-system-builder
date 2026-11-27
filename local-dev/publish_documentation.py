"""Publish bundled SDDS documentation into the existing local demo design system."""

import argparse
import base64
import io
import json
import os
from pathlib import Path, PurePosixPath
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class LocalApi:
    def __init__(self, gateway):
        parsed = urllib.parse.urlsplit(gateway)
        if (parsed.scheme not in ('http', 'https') or parsed.hostname not in
                ('localhost', '127.0.0.1', '::1', 'host.docker.internal') or
                parsed.username or parsed.password or parsed.path not in ('', '/') or
                parsed.query or parsed.fragment):
            raise ValueError('Documentation helper accepts only a local gateway URL')
        self.gateway = gateway.rstrip('/')
        self.opener = urllib.request.build_opener(NoRedirect)
        form = urllib.parse.urlencode({
            'grant_type': 'password', 'client_id': 'dsbuilder-api',
            'username': os.environ.get('DSBUILDER_LOCAL_USERNAME', 'admin@example.com'),
            'password': os.environ.get('DSBUILDER_LOCAL_PASSWORD', 'password'),
        }).encode()
        self.token = None
        self.token = self.request('/auth/token', form, 'application/x-www-form-urlencoded')['access_token']
        payload = self.token.split('.')[1]
        self.user_id = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['sub']

    def request(self, path, data=None, content_type=None, missing_ok=False, method=None):
        headers = {'Authorization': 'Bearer ' + self.token} if self.token else {}
        if content_type:
            headers['Content-Type'] = content_type
        request = urllib.request.Request(self.gateway + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if missing_ok and error.code == 404:
                return None
            raise RuntimeError(f'Local documentation API returned HTTP {error.code}: {path}') from None


def find_demo(api):
    projects = api.request('/api/projects')
    matches = []
    for project in projects:
        if project.get('ownerUserId') != api.user_id or project.get('status') == 'archived':
            continue
        project_id = project['id']
        names = ('sdds_serv_local', 'sdds_serv_local-' + project_id[:8])
        for system in api.request(f'/api/projects/{project_id}/design-systems'):
            if system['name'] in names:
                matches.append((project_id, system['id']))
    if len(matches) > 1:
        raise ValueError('More than one local demo design system; refusing an ambiguous publication')
    return matches[0] if matches else None


def bind_bundle(path, system_id, version):
    """Rebind the manifest without extracting files or altering generated code references."""
    output = io.BytesIO()
    found = False
    total = 0
    with tarfile.open(path, 'r:gz') as source, tarfile.open(fileobj=output, mode='w:gz') as target:
        for member in source:
            name = PurePosixPath(member.name)
            total += member.size
            if (name.is_absolute() or '..' in name.parts or
                    not (member.isfile() or member.isdir()) or total > 64 * 1024 * 1024):
                raise ValueError('Unsafe or oversized documentation archive')
            data = source.extractfile(member).read() if member.isfile() else None
            if str(name) == 'manifest.json':
                if found:
                    raise ValueError('Duplicate documentation manifest')
                manifest = json.loads(data)
                if manifest.get('platform') != 'compose':
                    raise ValueError('Expected Compose documentation')
                manifest['designSystem'] = {'id': system_id, 'version': version}
                data = json.dumps(manifest).encode()
                member.size = len(data)
                found = True
            target.addfile(member, io.BytesIO(data) if data is not None else None)
    if not found:
        raise ValueError('Documentation manifest is missing')
    return output.getvalue()


def publish(api, bundle, if_missing=False, timeout=90):
    demo = find_demo(api)
    if demo is None:
        print('[local-docs] No existing sdds_serv_local; documentation seed skipped')
        return None
    project_id, system_id = demo
    versions = api.request(f'/api/projects/{project_id}/design-systems/{system_id}/versions?limit=1')
    if not versions:
        raise ValueError('Publish a design-system version before its documentation')
    version = versions[0]['version']
    root = f'/api/projects/{project_id}/documentation'
    query = urllib.parse.urlencode({'designSystemId': system_id, 'platform': 'compose', 'version': version})
    active_path = root + '/publications/active?' + query
    if if_missing and (active := api.request(active_path, missing_ok=True)):
        print(f"[local-docs] Documentation {version} already published: {active['publicationId']}")
        return active
    archive = bind_bundle(bundle, system_id, version)
    boundary = 'local-docs-' + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="bundle"; '
            'filename="documentation.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n').encode()
    body += archive + f'\r\n--{boundary}--\r\n'.encode()
    accepted = api.request(root + '/bundles', body, 'multipart/form-data; boundary=' + boundary)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = api.request(root + '/ingestion-jobs/' + accepted['jobId'])
        if job['status'] == 'failed':
            codes = ', '.join(item['code'] for item in job.get('diagnostics', []) if item['level'] == 'error')
            raise RuntimeError('Documentation processing failed: ' + codes)
        if job['status'] == 'published':
            active = api.request(active_path)
            print(f"[local-docs] Published Compose documentation {version}: {active['publicationId']}")
            return active
        time.sleep(1)
    raise RuntimeError('Documentation processing timed out; inspect job ' + accepted['jobId'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gateway-url', default=os.environ.get('GATEWAY_URL', 'http://localhost:8080'))
    parser.add_argument('--bundle', type=Path, default=ROOT / 'local-dev/design-system/documentation.tar.gz')
    parser.add_argument('--if-missing', action='store_true', help='Preserve existing documentation for this version')
    args = parser.parse_args()
    try:
        publish(LocalApi(args.gateway_url), args.bundle, args.if_missing)
    except (ValueError, RuntimeError, OSError, tarfile.TarError) as error:
        parser.exit(1, f'[local-docs] {error}\n')


if __name__ == '__main__':
    main()
