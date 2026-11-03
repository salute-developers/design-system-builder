import importlib.util
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('s3_runner', Path(__file__).with_name('run_s3_integration.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class S3RunnerTest(unittest.TestCase):
    def test_unavailable_docker_fails_without_build_or_successful_skip(self):
        with patch.object(runner.shutil, 'which', return_value='/docker'), \
                patch.object(runner, 'docker', return_value=SimpleNamespace(returncode=1)), \
                patch.object(runner, 'build_image') as build:
            with self.assertRaisesRegex(RuntimeError, 'daemon is unavailable'):
                runner.main()
            build.assert_not_called()

    def test_client_failure_removes_only_the_two_containers_created_by_this_run(self):
        calls = []

        def docker(*arguments, **kwargs):
            calls.append(arguments)
            if arguments[:2] == ('run', '--rm'):
                raise subprocess.CalledProcessError(1, ['docker', *arguments])
            return SimpleNamespace(returncode=0)

        with patch.object(runner.shutil, 'which', return_value='/docker'), \
                patch.object(runner, 'docker', side_effect=docker), \
                patch.object(runner, 'build_image', side_effect=['test-minio', 'test-client']):
            with self.assertRaises(subprocess.CalledProcessError):
                runner.main()
        runs = [arguments for arguments in calls if arguments[0] == 'run']
        created_names = {arguments[arguments.index('--name') + 1] for arguments in runs}
        removed_names = {arguments[2] for arguments in calls if arguments[:2] == ('rm', '--force')}
        self.assertEqual(2, len(created_names))
        self.assertEqual(created_names, removed_names)
        self.assertTrue(any(arguments[0] == 'logs' for arguments in calls))
        for arguments in runs:
            self.assertNotIn('--publish', arguments)
            self.assertNotIn('--privileged', arguments)

    def test_missing_docker_is_an_error(self):
        with patch.object(runner.shutil, 'which', return_value=None), \
                patch.object(runner, 'docker') as docker:
            with self.assertRaisesRegex(RuntimeError, 'Docker is required'):
                runner.main()
            docker.assert_not_called()

    def test_cleanup_failure_is_reported_and_both_removals_are_attempted(self):
        removals = []

        def docker(*arguments, **kwargs):
            if arguments[:2] == ('rm', '--force'):
                removals.append(arguments[2])
                return SimpleNamespace(returncode=1, stderr='Docker daemon unavailable')
            return SimpleNamespace(returncode=0)

        with patch.object(runner.shutil, 'which', return_value='/docker'), \
                patch.object(runner, 'docker', side_effect=docker), \
                patch.object(runner, 'build_image', side_effect=['test-minio', 'test-client']):
            with self.assertRaisesRegex(RuntimeError, 'Cannot clean up test containers'):
                runner.main()
        self.assertEqual(2, len(removals))
