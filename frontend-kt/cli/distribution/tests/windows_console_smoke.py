"""Checks a real Windows CLI using an isolated console and an actual Ctrl+C event."""

import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def main():
    if os.name != 'nt':
        raise SystemExit('This check requires Windows')
    cli = Path(sys.argv[1]).resolve(strict=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetConsoleWindow.restype = wintypes.HWND
    kernel.SetConsoleCtrlHandler.argtypes = [ctypes.c_void_p, wintypes.BOOL]
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.FreeConsole()
    if not kernel.AllocConsole():
        raise ctypes.WinError(ctypes.get_last_error())
    user = ctypes.WinDLL('user32')
    user.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user.ShowWindow(kernel.GetConsoleWindow(), 0)
    # The helper ignores broadcasts; the CLI must explicitly enable and handle Ctrl+C.
    if not kernel.SetConsoleCtrlHandler(None, True):
        raise ctypes.WinError(ctypes.get_last_error())

    def alive(pid):
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        try:
            code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)):
                raise ctypes.WinError(ctypes.get_last_error())
            return code.value == 259
        finally:
            kernel.CloseHandle(handle)

    def interrupt(process):
        if not kernel.GenerateConsoleCtrlEvent(0, 0):
            raise ctypes.WinError(ctypes.get_last_error())
        # Fail before the seven-second emergency fallback: normal coroutine cleanup must work.
        code = process.wait(timeout=6)
        if code != 130:
            raise AssertionError(f'Expected cancellation exit130, got {code}')

    try:
        with tempfile.TemporaryDirectory(prefix='dsbuilder console ') as temporary:
            root = Path(temporary)
            home = root / 'home'
            home.mkdir()
            project = root / 'project'
            project.mkdir()
            pids_file = root / 'children.pid'
            child = root / 'generator.py'
            child.write_text(
                "import os,signal,subprocess,sys,time\n"
                "signal.signal(signal.SIGINT,signal.SIG_IGN)\n"
                "p=subprocess.Popen([sys.executable,'-c',"
                "'import signal,time;signal.signal(signal.SIGINT,signal.SIG_IGN);time.sleep(60)'])\n"
                "open(os.environ['DSB_CHILD_PIDS'],'w').write(str(os.getpid())+'\\n'+str(p.pid))\n"
                "time.sleep(60)\n"
            )
            tools = home / '.dsbuilder/toolchains/web'
            tools.mkdir(parents=True)
            (tools / 'dsbuilder-web-generator.cmd').write_text(
                '@echo off\r\nif "%~1"=="--version" (echo fixture&exit /b 0)\r\n'
                '@"%DSB_PYTHON%" "%DSB_CHILD_SCRIPT%" %*\r\n'
            )
            env = dict(os.environ, HOME=str(home), USERPROFILE=str(home), DSBUILDER_ANALYTICS_DISABLED='1',
                       DSB_PYTHON=sys.executable, DSB_CHILD_SCRIPT=str(child), DSB_CHILD_PIDS=str(pids_file))
            subprocess.run([str(cli), 'init', '--project-id', 'fixture', '--design-system-id', 'fixture',
                            '--platform', 'react'], cwd=project, env=env, check=True, capture_output=True, timeout=30)
            process = subprocess.Popen([str(cli), 'theme', 'generate'], cwd=project, env=env,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            pids = []
            try:
                deadline = time.monotonic() + 15
                while not pids_file.exists() or len(pids_file.read_text().splitlines()) != 2:
                    if time.monotonic() > deadline:
                        raise AssertionError('Generator did not start')
                    time.sleep(.02)
                pids = list(map(int, pids_file.read_text().splitlines()))
                interrupt(process)
                deadline = time.monotonic() + 3
                while any(alive(pid) for pid in pids) and time.monotonic() < deadline:
                    time.sleep(.02)
                if any(alive(pid) for pid in pids):
                    raise AssertionError('Owned generator processes survived Ctrl+C')
            finally:
                if process.poll() is None:
                    process.kill()
                process.communicate(timeout=10)
                for pid in pids:
                    if alive(pid):
                        subprocess.run(['taskkill', '/PID', str(pid), '/T', '/F'], capture_output=True, check=False)

            process = subprocess.Popen([str(cli), 'mcp', 'serve'], cwd=project, env=env,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                request = {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
                    'protocolVersion': '2024-11-05', 'capabilities': {},
                    'clientInfo': {'name': 'console-smoke', 'version': '0'}}}
                process.stdin.write((json.dumps(request) + '\n').encode())
                process.stdin.flush()
                # readline is bounded by the watchdog in this isolated test process below.
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    response = executor.submit(process.stdout.readline)
                    try:
                        message = json.loads(response.result(timeout=10))
                        if message.get('id') != 1 or 'result' not in message:
                            raise AssertionError('MCP initialize failed')
                        interrupt(process)
                    finally:
                        if process.poll() is None:
                            process.kill()
            finally:
                if process.poll() is None:
                    process.kill()
                process.communicate(timeout=10)
            print('Windows Ctrl+C: exit130, generator tree stopped, idle MCP stopped with stdin open')
    finally:
        kernel.FreeConsole()


if __name__ == '__main__':
    main()
