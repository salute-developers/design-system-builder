from functools import partial
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
import zipfile

from test_release import DIST, make_archive, release


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.server.requests.append(self.path)
        redirect = self.server.redirects.get(self.path)
        if redirect:
            status, location = redirect
            self.send_response(status)
            self.send_header('Location', location)
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *args):
        pass


class InstallTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='CLI tests with spaces ')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / 'tools'
        self.bin.mkdir()
        self.env = dict(os.environ, HOME=str(self.root / 'home'),
                        DSBUILDER_INSTALL_DIR=str(self.root / 'CLI install'),
                        DSBUILDER_BIN_DIR=str(self.root / 'CLI bin'),
                        PATH=str(self.bin) + os.pathsep + os.environ['PATH'])
        self.env.pop('JAVA_HOME', None)
        self.tool('java', '#!/bin/sh\necho \'openjdk version "17.0.2"\' >&2\n')
        self.webroot = self.root / 'web'
        self.version_dir = self.webroot / 'releases/1.2.3'
        self.version_dir.mkdir(parents=True)
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(self.webroot)))
        self.server.redirects = {}
        self.server.requests = []
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.stopped = False
        self.addCleanup(self.stop_server)
        self.env['CLI_DOWNLOAD_BASE_URL'] = f'http://127.0.0.1:{self.server.server_port}'
        self.archive = make_archive(self.version_dir, 'jvm')
        self.update_sums()
        (self.webroot / 'stable.json').write_bytes(release.json_bytes({'schemaVersion': 1, 'version': '1.2.3'}))

    def stop_server(self):
        if self.stopped:
            return
        self.stopped = True
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tool(self, name, body):
        path = self.bin / name
        path.write_text(body)
        path.chmod(0o755)

    def update_sums(self):
        (self.version_dir / 'SHA256SUMS').write_text(f'{release.digest(self.archive.read_bytes())}  {self.archive.name}\n')

    def run_install(self, *args, success=True):
        result = subprocess.run(['/bin/sh', str(DIST / 'bootstrap/install.sh'), *args], env=self.env,
                                capture_output=True, text=True, timeout=20)
        if success:
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        else:
            self.assertNotEqual(0, result.returncode, result.stdout + result.stderr)
        return result

    def test_network_latest_explicit_repeat_and_unrelated_files(self):
        self.run_install('--target', 'jvm')
        installation = Path(self.env['DSBUILDER_INSTALL_DIR'])
        (installation / 'user-file').write_text('keep')
        self.run_install('--target', 'jvm', '--version', '1.2.3')
        self.assertEqual('keep', (installation / 'user-file').read_text())
        command = Path(self.env['DSBUILDER_BIN_DIR']) / 'dsbuilder'
        result = subprocess.run([str(command)], capture_output=True, text=True)
        self.assertEqual('fixture', result.stdout.strip())

    def test_checksum_failure_preserves_previous_cli(self):
        self.run_install('--target', 'jvm')
        previous = (Path(self.env['DSBUILDER_INSTALL_DIR']) / 'bin/dsbuilder').read_bytes()
        self.archive.write_bytes(b'corrupt')
        result = self.run_install('--target', 'jvm', success=False)
        self.assertIn('SHA-256 mismatch', result.stderr)
        self.assertEqual(previous, (Path(self.env['DSBUILDER_INSTALL_DIR']) / 'bin/dsbuilder').read_bytes())

    def test_missing_archive_and_invalid_manifest(self):
        self.archive.unlink()
        self.run_install('--target', 'jvm', success=False)
        (self.webroot / 'stable.json').write_text('{"version":"../../bad"}')
        self.run_install('--target', 'jvm', success=False)
        self.assertFalse(Path(self.env['DSBUILDER_INSTALL_DIR']).exists())

    def test_path_traversal_rejected_even_with_valid_hash(self):
        with zipfile.ZipFile(self.archive, 'a') as archive:
            archive.writestr('dsbuilder-cli-jvm/../../../escape', 'bad')
        self.update_sums()
        self.run_install('--target', 'jvm', success=False)
        self.assertFalse(Path(self.env['DSBUILDER_INSTALL_DIR']).exists())

    def test_symlink_rejected_even_with_valid_hash(self):
        with zipfile.ZipFile(self.archive, 'a') as archive:
            info = zipfile.ZipInfo('dsbuilder-cli-jvm/link')
            info.external_attr = 0o120777 << 16
            archive.writestr(info, '/tmp')
        self.update_sums()
        self.run_install('--target', 'jvm', success=False)

    def test_java_old_and_missing(self):
        self.tool('java', '#!/bin/sh\necho \'java version "1.8.0"\' >&2\n')
        self.assertIn('Java 17+', self.run_install('--target', 'jvm', success=False).stderr)
        self.tool('java', '#!/bin/sh\nexit 127\n')
        self.assertIn('Java 17+', self.run_install('--target', 'jvm', success=False).stderr)

    def test_invalid_version_and_unsupported_platform(self):
        self.run_install('--target', 'jvm', '--version', '../bad', success=False)
        self.run_install('--target', 'unknown', success=False)
        self.tool('uname', '#!/bin/sh\necho unsupported\n')
        self.run_install(success=False)

    def test_native_architecture_selection(self):
        for machine, target in [('arm64', 'macos-arm64'), ('x86_64', 'macos-x64')]:
            self.tool('uname', f'#!/bin/sh\ncase "$1" in -s) echo Darwin ;; *) echo {machine} ;; esac\n')
            self.archive = make_archive(self.version_dir, target)
            self.update_sums()
            self.run_install()
            self.assertTrue((Path(self.env['DSBUILDER_INSTALL_DIR']) / 'dsbuilder').exists())

    def test_local_installer_needs_no_network(self):
        package = self.root / 'unpacked'
        with zipfile.ZipFile(self.archive) as archive:
            archive.extractall(package)
        self.stop_server()
        installer = package / 'dsbuilder-cli-jvm/install.sh'
        result = subprocess.run(['sh', str(installer)], env=self.env, capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)

    def test_link_failure_rolls_back_binary(self):
        self.run_install('--target', 'jvm')
        old = (Path(self.env['DSBUILDER_INSTALL_DIR']) / 'bin/dsbuilder').read_bytes()
        real_mv = shutil.which('mv')
        self.tool('mv', f'#!/bin/sh\ncase "$*" in *".dsbuilder-link."*) exit 1 ;; esac\nexec "{real_mv}" "$@"\n')
        make_archive(self.version_dir, 'jvm', b'#!/bin/sh\necho changed\n')
        self.update_sums()
        self.run_install('--target', 'jvm', success=False)
        self.assertEqual(old, (Path(self.env['DSBUILDER_INSTALL_DIR']) / 'bin/dsbuilder').read_bytes())

    def test_command_symlink_to_directory_is_rejected(self):
        outside = self.root / 'unrelated directory'
        outside.mkdir()
        bin_dir = Path(self.env['DSBUILDER_BIN_DIR'])
        bin_dir.mkdir()
        command = bin_dir / 'dsbuilder'
        command.symlink_to(outside, target_is_directory=True)
        self.run_install('--target', 'jvm', success=False)
        self.assertEqual(outside.resolve(), command.resolve())
        self.assertEqual([], list(outside.iterdir()))
        self.assertFalse(Path(self.env['DSBUILDER_INSTALL_DIR']).exists())

    def test_old_native_binary_symlink_does_not_modify_external_file(self):
        outside = self.root / 'unrelated file'
        outside.write_text('keep')
        outside.chmod(0o600)
        installation = Path(self.env['DSBUILDER_INSTALL_DIR'])
        installation.mkdir()
        (installation / 'dsbuilder').symlink_to(outside)
        self.tool('uname', '#!/bin/sh\ncase "$1" in -s) echo Darwin ;; *) echo arm64 ;; esac\n')
        self.archive = make_archive(self.version_dir, 'macos-arm64')
        self.update_sums()
        self.run_install()
        self.assertEqual('keep', outside.read_text())
        self.assertEqual(0o600, outside.stat().st_mode & 0o777)
        self.assertFalse((installation / 'dsbuilder').is_symlink())

    def test_local_contour_reuses_installer_and_keeps_path_setup(self):
        frontend = self.root / 'local frontend'
        distribution = frontend / 'cli/distribution'
        distribution.mkdir(parents=True)
        for name in ('install-macos-cli.sh', 'install-unix-common.sh'):
            shutil.copyfile(DIST / name, distribution / name)
        wrapper = frontend / 'install-local-cli.sh'
        shutil.copyfile(DIST.parents[1] / 'install-local-cli.sh', wrapper)
        gradle = frontend / 'gradlew'
        gradle.write_text('#!/bin/sh\nexit 0\n')
        gradle.chmod(0o755)
        binary = frontend / 'cli/build/bin/macosArm64/releaseExecutable/dsbuilder.kexe'
        binary.parent.mkdir(parents=True)
        binary.write_text('#!/bin/sh\necho local\n')
        home = Path(self.env['HOME'])
        home.mkdir()
        self.env.update(SHELL='/bin/zsh', DSBUILDER_MACOS_ARCH='arm64',
                        DSBUILDER_BIN_DIR=str(self.root / "CLI bin with ' quote"))
        for _ in range(2):
            result = subprocess.run(['sh', str(wrapper)], env=self.env, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr)
        profile = home / '.zshrc'
        self.assertEqual(1, profile.read_text().count('export PATH='))
        result = subprocess.run(['sh', '-c', '. "$1"; printf "%s" "$PATH"', '--', str(profile)],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(result.stdout.startswith(self.env['DSBUILDER_BIN_DIR'] + ':'))

    def test_missing_download_unpack_and_hash_tools_fail_before_installation(self):
        tools = ('uname', 'sed', 'head', 'grep', 'awk', 'mktemp', 'unzip', 'zipinfo',
                 'tr', 'cut', 'rm', 'mkdir', 'curl', 'wget', 'shasum', 'sha256sum')
        for missing, expected in [(('curl', 'wget'), 'curl or wget is required'),
                                  (('unzip',), 'Required tool missing: unzip'),
                                  (('shasum', 'sha256sum'), 'shasum or sha256sum is required')]:
            with self.subTest(missing=missing):
                limited = self.root / ('limited-' + missing[0])
                limited.mkdir()
                shutil.copyfile(self.bin / 'java', limited / 'java')
                (limited / 'java').chmod(0o755)
                for tool in tools:
                    executable = shutil.which(tool)
                    if tool not in missing and executable:
                        (limited / tool).symlink_to(executable)
                self.env['PATH'] = str(limited)
                result = self.run_install('--target', 'jvm', success=False)
                self.assertIn(expected, result.stderr)
                self.assertFalse(Path(self.env['DSBUILDER_INSTALL_DIR']).exists())

    def test_redirects_are_rejected_at_every_download_stage(self):
        self.run_install('--target', 'jvm')
        binary = Path(self.env['DSBUILDER_INSTALL_DIR']) / 'bin/dsbuilder'
        previous = binary.read_bytes()
        paths = ('/stable.json', '/releases/1.2.3/SHA256SUMS',
                 '/releases/1.2.3/dsbuilder-cli-jvm.zip')
        for status in (301, 302, 303, 307, 308):
            for path in paths:
                with self.subTest(status=status, path=path):
                    self.server.redirects = {path: (status, '/redirect-target')}
                    self.server.requests.clear()
                    self.run_install('--target', 'jvm', success=False)
                    self.assertNotIn('/redirect-target', self.server.requests)
                    self.assertEqual(previous, binary.read_bytes())
        self.server.redirects = {}
