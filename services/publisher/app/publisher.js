const path = require('path');
const fs = require('fs');
import { spawn } from 'child_process';

function dryRunPublish(tgzPath) {
  return new Promise((resolve, reject) => {
    const args = ['publish', tgzPath, '--dry-run'];
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, args, {
      stdio: 'pipe',
      cwd: path.dirname(tgzPath),
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; process.stdout.write(s); });
    child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; process.stderr.write(s); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, info: parsePackageFromDryRun(stdout) });
      } else {
        reject(new Error(stderr || stdout || 'Dry-run failed'));
      }
    });

    child.on('error', (err) => reject(new Error(`npm failed to start: ${err.message}`))); 

    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill();
        reject(new Error('Dry-run timeout (60s)'));
      }
    }, 60000);
  });
}

// ---- помощники для npm publish (перенесено из server.js) ----
async function publishNpmPackage(tgzPath, npmToken) {
  return new Promise((resolve, reject) => {
    const npmrcPath = path.join(path.dirname(tgzPath), '.npmrc');
    const npmrcContent = `//registry.npmjs.org/:_authToken=${npmToken}\nregistry=https://registry.npmjs.org/\nalways-auth=true\n`;

    fs.writeFileSync(npmrcPath, npmrcContent);

    const args = ['publish', tgzPath, '--userconfig', npmrcPath];
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, args, {
      stdio: 'pipe',
      cwd: path.dirname(tgzPath),
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; process.stdout.write(s); });
    child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; process.stderr.write(s); });

    const clean = () => { try { if (fs.existsSync(npmrcPath)) fs.rmSync(npmrcPath); } catch (_) {} };

    child.on('close', (code) => {
      clean();
      if (code === 0) {
        const info = parseNpmPublishOutput(stdout);
        resolve({ packageName: info.name, version: info.version, stdout });
      } else {
        const msg = analyzeNpmError(stderr || stdout, tgzPath);
        reject(new Error(msg));
      }
    });

    child.on('error', (err) => {
      clean();
      reject(new Error(`npm failed to start: ${err.message}`));
    });

    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill();
        clean();
        reject(new Error('Publish timeout (60s)'));
      }
    }, 60000);
  });
}

function analyzeNpmError(errorOutput, filePath) {
  if (errorOutput.includes('code 128') && errorOutput.includes('git')) {
    return `npm интерпретировал путь как git URL. Проверьте путь к файлу: ${filePath}`;
  }
  if (errorOutput.includes('EPUBLISHCONFLICT')) {
    return 'Версия уже существует. Увеличьте версию в package.json.';
  }
  if (errorOutput.includes('E403')) {
    if (errorOutput.includes('forbidden') || errorOutput.includes('public')) {
      return 'Доступ запрещен: имя уже занято или у токена нет прав.';
    }
    return 'Доступ запрещен. Проверьте NPM токен.';
  }
  if (errorOutput.includes('E404')) {
    return 'Registry недоступен или пакет не найден.';
  }
  if (errorOutput.includes('Invalid package')) {
    return 'Некорректный package.json в архиве.';
  }
  if (errorOutput.includes('incorrect header check')) {
    return 'Файл поврежден или неверный формат (.tgz).';
  }
  return `Ошибка публикации: ${errorOutput.substring(0, 300)}`;
}

function parseNpmPublishOutput(output) {
  const patterns = [
    /\+ (.+?)@(.+?)$/m,
    /published (.+?)@(.+?) to registry/,
    /successfully published (.+?)@(.+?)$/,
    /√ Package (.+?)@(.+?) published/
  ];
  for (const p of patterns) {
    const m = output.match(p);
    if (m) return { name: m[1], version: m[2] };
  }
  // запасной вариант: попытаться вытащить данные из имени файла (если присутствует в выводе)
  return { name: 'unknown-package', version: '0.0.0' };
}

function parsePackageFromDryRun(output) {
  // Пытаемся распознать самые распространённые шаблоны из вывода npm --dry-run
  const patterns = [
    /npm notice\s+📦\s+(@[^\s@/]+\/[\w.-]+|[^\s@]+)@(\d+\.\d+\.\d+)/,
    /npm notice\s+(@[^\s@/]+\/[\w.-]+|[^\s@]+)@(\d+\.\d+\.\d+)/,
    /name:\s*([@\w./-]+)\s*\n[\s\S]*?version:\s*(\d+\.\d+\.\d+)/
  ];
  for (const p of patterns) {
    const m = output.match(p);
    if (m) return { name: m[1], version: m[2] };
  }
  // Финальный запасной вариант: неизвестно
  return { name: 'unknown-package', version: '0.0.0' };
}

async function dryRun(tgzPath) {
  return dryRunPublish(tgzPath);
}

async function publish(tgzPath, npmToken) {
  return publishNpmPackage(tgzPath, npmToken);
}

module.exports = {
  dryRun,
  publish,
  // Exporting low-level helpers if server or tests need them later
  _helpers: {
    analyzeNpmError,
    parseNpmPublishOutput,
    parsePackageFromDryRun,
  },
};