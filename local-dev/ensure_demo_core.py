"""Bind only the local demo draft to the exact Core of its published preview archive."""
import argparse
import json
import os
import urllib.parse
import urllib.error
import zipfile

from publish_documentation import LocalApi, find_demo
from select_core_release import find_release, manifest_from


def ensure(api, archive):
    demo = find_demo(api)
    if demo is None:
        print('[local-core] No existing local demo; Core selection skipped')
        return
    project, system = demo
    root = f'/api/projects/{project}/design-systems/{system}'
    context = api.request(root + '/core-settings')['context']
    selected = [r for r in context['coreReleases'] if r['platform'] == 'compose']
    if len(selected) > 1:
        raise ValueError('Ambiguous Compose Core selection in local demo')
    if selected and selected[0].get('provenance') != 'migration-snapshot':
        print('[local-core] Preserving explicitly selected Compose Core ' + selected[0]['releaseId'])
        return
    manifest = manifest_from(str(archive))

    def load(channel, offset, limit):
        query = urllib.parse.urlencode(dict(platform='compose', channel=channel, offset=offset, limit=limit))
        return api.request(root + '/core-releases?' + query)

    release = find_release(load, manifest=manifest)
    command = dict(channel=release['channel'], releaseId=release['releaseId'],
                   expectedDraftId=context['draftId'],
                   expectedCoreSelectionRevision=context['coreSelectionRevision'])
    api.request(root + '/core-settings/compose', json.dumps(command).encode(),
                'application/json', method='PUT')
    preview = api.request(root + '/preview/compose')
    if preview['coreRelease']['releaseId'] != release['releaseId']:
        raise ValueError('Selected demo Core does not match its preview')
    print('[local-core] Selected Compose Core ' + release['version'] + '; preview ' + preview['buildId'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True)
    args = parser.parse_args()
    try:
        ensure(LocalApi(os.environ.get('GATEWAY_URL', 'http://localhost:8080')), args.archive)
    except (ValueError, RuntimeError, OSError, zipfile.BadZipFile, urllib.error.URLError) as error:
        parser.exit(1, f'[local-core] {error}\n')


if __name__ == '__main__':
    main()
