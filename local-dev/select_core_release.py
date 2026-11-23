#!/usr/bin/env python3
"""Select an exact registered Compose release for local setup; never select latest."""
import argparse
import io
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import zipfile


def manifest_from(source):
    if source.startswith(('http://', 'https://')):
        with urllib.request.urlopen(source, timeout=120) as response:
            raw = response.read()
    else:
        raw = Path(source).read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        manifest = json.loads(archive.read('preview-plugin.json'))
    ref = manifest.get('coreRelease', {})
    if ref.get('platform') != 'compose' or not ref.get('libraryId') or not ref.get('version'):
        raise ValueError('Archive has no Compose Core coordinates; pass a compatible ZIP or --core-release-id')
    return manifest


def find_release(load_page, release_id='', manifest=None):
    # Publication chooses the channel; a legacy archive field is not authoritative.
    for channel in ('stable', 'dev'):
        offset = 0
        while True:
            page = load_page(channel, offset, 100)
            for release in page:
                ref = manifest['coreRelease'] if manifest else None
                matches = release['releaseId'] == release_id if release_id else (
                    ref is not None and release['libraryId'] == ref['libraryId']
                    and release['version'] == ref['version'] and release['platform'] == ref['platform']
                    and release['metaSha256'] == manifest['apiMetaSha256']
                )
                if matches:
                    return release
            if len(page) < 100:
                break
            offset += len(page)
    raise ValueError('Exact Core is not registered; import that release before seeding')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-root', required=True)
    parser.add_argument('--release-id', default='')
    parser.add_argument('--archive', default='')
    args = parser.parse_args()
    token = os.environ['DSBUILDER_LOCAL_ACCESS_TOKEN']
    def read(path):
        request = urllib.request.Request(args.api_root + path, headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    def load(channel, offset, limit):
        return read('/core-releases?' + urllib.parse.urlencode(dict(platform='compose', channel=channel, offset=offset, limit=limit)))
    manifest = None if args.release_id else manifest_from(args.archive)
    release = find_release(load, args.release_id, manifest)
    context = read('/core-settings')['context']
    print(json.dumps(dict(channel=release['channel'], releaseId=release['releaseId'],
                         expectedDraftId=context['draftId'], expectedCoreSelectionRevision=context['coreSelectionRevision'])))


if __name__ == '__main__':
    main()
