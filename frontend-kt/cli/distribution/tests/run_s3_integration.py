"""Одна команда для изолированного S3-теста: нужен Python и работающий Docker."""
import hashlib
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import uuid

DIST = Path(__file__).resolve().parents[1]
REPOSITORY = DIST.parents[2]


def docker(*arguments, check=True, capture=False):
    return subprocess.run(['docker', *map(str, arguments)], check=check,
                          capture_output=capture, text=True)


def build_image(dockerfile, name):
    fingerprint = hashlib.sha256(dockerfile.read_bytes()).hexdigest()[:12]
    image = f'{name}:{fingerprint}'
    # Docker сам переиспользует подходящие слои; никаких ручных образов или настроек.
    docker('build', '--file', dockerfile, '--tag', image, dockerfile.parent)
    return image


def main():
    if not shutil.which('docker'):
        raise RuntimeError('Docker is required. Start Docker Desktop or Docker Engine and retry.')
    if docker('info', '--format', '{{.ServerVersion}}', check=False, capture=True).returncode:
        raise RuntimeError('Docker daemon is unavailable. Start Docker Desktop or Docker Engine and retry.')
    minio_image = build_image(REPOSITORY / 'backend-kt/docker/minio/Dockerfile', 'dsbuilder-cli-minio-test')
    client_image = build_image(DIST / 'tests/Dockerfile.s3-test', 'dsbuilder-cli-s3-test')
    identifier = uuid.uuid4().hex
    minio_name = 'dsbuilder-cli-minio-' + identifier
    client_name = 'dsbuilder-cli-s3-' + identifier
    try:
        # Нет host ports, volumes с данными пользователя или доступа к реальному S3.
        docker('run', '--detach', '--name', minio_name, '--network', 'none',
               '--env', 'MINIO_ROOT_USER=cli-test-user',
               '--env', 'MINIO_ROOT_PASSWORD=cli-test-password',
               minio_image, 'server', '/data')
        # Общий только network namespace: loopback MinIO доступен клиенту, внешней сети нет.
        docker('run', '--rm', '--name', client_name, '--network', 'container:' + minio_name,
               '--mount', f'type=bind,source={DIST},target=/workspace,readonly', client_image)
    except (Exception, KeyboardInterrupt):
        docker('logs', '--tail', '60', minio_name, check=False)
        raise
    finally:
        # Уникальные имена ограничивают удаление ресурсами текущего запуска.
        failed_cleanup = []
        for name in (client_name, minio_name):
            try:
                result = docker('rm', '--force', name, check=False, capture=True)
                if result.returncode and 'no such container' not in result.stderr.lower():
                    failed_cleanup.append(name)
            except OSError:
                failed_cleanup.append(name)
        if failed_cleanup:
            raise RuntimeError('Cannot clean up test containers: ' + ', '.join(failed_cleanup))


def terminate(signum, frame):
    raise KeyboardInterrupt('Test terminated')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, terminate)
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, KeyboardInterrupt) as error:
        print(f'S3 integration failed: {error}', file=sys.stderr)
        sys.exit(1)
