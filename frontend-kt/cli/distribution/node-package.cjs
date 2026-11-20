'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

function run(command, args, options = {}) {
    let executable = command;
    let argumentsList = args;
    const batch = process.platform === 'win32' && /\.cmd$/i.test(command);
    if (batch) {
        const quote = value => {
            assert(!/["%^!\r\n]/.test(value), 'Unsupported batch argument');
            return `"${value}"`;
        };
        executable = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
        argumentsList = ['/d', '/v:off', '/s', '/c', `"${[command, ...args].map(quote).join(' ')}"`];
    }
    const result = spawnSync(executable, argumentsList, {
        encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
        windowsVerbatimArguments: batch, ...options,
    });
    if (result.error) throw result.error;
    if (result.status !== (options.expectedStatus ?? 0)) {
        throw new Error(`${command} failed (${result.status}): ${result.stdout}\n${result.stderr}`);
    }
    return result.stdout;
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function verify(directory, version) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.name, '@sddsjs/design-system-builder-cli');
    assert.equal(manifest.version, version);
    assert.equal(manifest.publishConfig.access, 'public');
    assert.equal(manifest.engines.node, '>=22');
    assert.equal(manifest.private, undefined);
    const [packed] = JSON.parse(run(npm, ['pack', '--dry-run', '--ignore-scripts', '--json', directory]));
    const names = packed.files.map(file => file.path);
    for (const name of ['package.json', 'README.md', 'LICENSE', 'bin/dsbuilder.js',
        'dist/kotlin/design-system-builder-frontend-cli.js']) assert(names.includes(name), `Missing ${name}`);
    for (const name of names) {
        assert(!name.split('/').some(part => ['.sdds', '.env', '.npmrc', 'node_modules', '.gradle', '.kotlin'].includes(part)), name);
        assert(!/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|[.-]test\.js$|\.map$/i.test(name), `Unexpected package file: ${name}`);
    }
    for (const version of Object.values(manifest.dependencies ?? {})) {
        assert(!/^(file:|link:|workspace:|\/)/.test(version), 'Local package dependency');
    }
}

function pack(directory, destination) {
    fs.mkdirSync(destination, { recursive: true });
    const [packed] = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', destination, directory]));
    fs.renameSync(path.join(destination, packed.filename), path.join(destination, 'dsbuilder-cli-node.tgz'));
}

function smoke(tarball) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dsbuilder-cli-package-'));
    try {
        const prefix = path.join(temporary, 'prefix');
        const home = path.join(temporary, 'home');
        fs.mkdirSync(home);
        const env = { ...process.env, HOME: home, USERPROFILE: home, DSBUILDER_ANALYTICS_DISABLED: '1',
            DSBUILDER_API_URL: 'http://127.0.0.1:9' };
        delete env.DSBUILDER_API_KEY;
        delete env.DSBUILDER_WEB_TOOL;
        delete env.NODE_AUTH_TOKEN;
        delete env.NPM_TOKEN;
        run(npm, ['install', '-g', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', tarball], { env });
        const command = process.platform === 'win32' ? path.join(prefix, 'dsbuilder.cmd') : path.join(prefix, 'bin', 'dsbuilder');
        const manifest = JSON.parse(fs.readFileSync(path.join(prefix,
            process.platform === 'win32' ? '' : 'lib', 'node_modules', '@sddsjs', 'design-system-builder-cli', 'package.json')));
        assert.equal(run(command, ['--version'], { env, cwd: temporary }).trim(), `dsbuilder version ${manifest.version}`);
        for (const args of [[], ['auth'], ['theme'], ['components'], ['ds'], ['docs'], ['toolchain'],
            ['icons'], ['preview-plugin'], ['analytics'], ['mcp'], ['mcp', 'serve']]) {
            assert.match(run(command, [...args, '--help'], { env, cwd: temporary }), /Usage:/);
        }
        run(command, ['unknown-command'], { env, cwd: temporary, expectedStatus: 1 });
        assert(!fs.existsSync(path.join(temporary, '.sdds')));
        const docs = path.join(temporary, 'docs');
        fs.mkdirSync(path.join(docs, 'content', 'core'), { recursive: true });
        fs.writeFileSync(path.join(docs, 'structure-core.json'), JSON.stringify({ schemaVersion: '1.0', navigation: [] }));
        const longName = 'nested/'.repeat(18) + 'данные.bin';
        fs.mkdirSync(path.dirname(path.join(docs, longName)), { recursive: true });
        const payload = Buffer.from([0, 128, 255, 42]);
        fs.writeFileSync(path.join(docs, longName), payload);
        const archive = path.join(docs, 'z-docs.tar.gz');
        run(command, ['docs', 'generate', '--docs-dir', docs, '--output', archive, '--platform', 'design'], { env, cwd: temporary });
        const entries = tarEntries(zlib.gunzipSync(fs.readFileSync(archive)));
        assert(entries.has('docs.json'));
        assert(entries.has('manifest.json'));
        assert(!entries.has('structure-core.json'));
        assert(!entries.has('z-docs.tar.gz'));
        assert.deepEqual(entries.get(longName), payload, JSON.stringify([...entries.keys()]));
        const library = require(require.resolve('fflate', { paths: [path.dirname(path.dirname(command)),
            path.join(prefix, process.platform === 'win32' ? '' : 'lib', 'node_modules', '@sddsjs', 'design-system-builder-cli')] }));
        const plugin = path.join(temporary, 'plugin.zip');
        fs.writeFileSync(plugin, library.zipSync({ 'preview-plugin.json': Buffer.from('{}') }));
        assert.match(run(command, ['preview-plugin', 'publish', '--platform', 'compose', '--from', plugin],
            { env, cwd: temporary, expectedStatus: 1 }), /has no api-meta\.json/);
        fs.writeFileSync(plugin, 'not a zip');
        assert.match(run(command, ['preview-plugin', 'publish', '--platform', 'compose', '--from', plugin],
            { env, cwd: temporary, expectedStatus: 1 }), /not a readable zip/);
        // Exercise the installed CLI's actual ProcessRunner, including .cmd on Windows.
        run(command, ['init', '--project-id', 'fixture-project', '--design-system-id', 'fixture-system', '--platform', 'react'],
            { env, cwd: temporary });
        const collector = path.join(temporary, 'collect arguments.cjs');
        const argumentsFile = path.join(temporary, 'arguments.json');
        fs.writeFileSync(collector, `if(process.argv[2]==='--version')console.log('fixture-1.0');else require('fs').writeFileSync(process.env.DSB_ARGS_FILE,JSON.stringify(process.argv.slice(2)));`);
        const managed = path.join(home, '.dsbuilder', 'toolchains', 'web');
        const tool = process.platform === 'win32'
            ? path.join(managed, 'dsbuilder-web-generator.cmd')
            : path.join(managed, 'bin', 'dsbuilder-web-generator');
        fs.mkdirSync(path.dirname(tool), { recursive: true });
        fs.writeFileSync(tool, process.platform === 'win32'
            ? '@"%DSB_TOOL_NODE%" "%DSB_TOOL_SCRIPT%" %*\r\n'
            : '#!/bin/sh\nexec "$DSB_TOOL_NODE" "$DSB_TOOL_SCRIPT" "$@"\n', { mode: 0o755 });
        const toolEnv = { ...env, DSB_TOOL_NODE: process.execPath, DSB_TOOL_SCRIPT: collector, DSB_ARGS_FILE: argumentsFile };
        const passthrough = 'пробелы & literal data';
        run(command, ['theme', 'generate', '--', passthrough], { env: toolEnv, cwd: temporary });
        const argumentsList = JSON.parse(fs.readFileSync(argumentsFile, 'utf8'));
        assert.equal(argumentsList[0], 'theme');
        assert.equal(argumentsList.at(-1), passthrough);
        if (process.platform === 'win32') {
            fs.unlinkSync(argumentsFile);
            run(command, ['theme', 'generate', '--', '%DSB_UNSAFE%'],
                { env: toolEnv, cwd: temporary, expectedStatus: 1 });
            assert(!fs.existsSync(argumentsFile));
        }
        const rpc = [
            { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'package-smoke', version: '0' } } },
            { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
            { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        ].map(value => JSON.stringify(value)).join('\n') + '\n';
        const messages = run(command, ['mcp', 'serve'], { env, cwd: temporary, input: rpc })
            .trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        assert(messages.some(message => message.id === 1 && message.result));
        assert(messages.some(message => message.id === 2 && message.result.tools.some(tool => tool.name === 'design_system_get_context')));
        console.log(`Node CLI package smoke passed: ${manifest.version}`);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

function tarEntries(bytes) {
    const entries = new Map();
    for (let offset = 0; offset + 512 <= bytes.length;) {
        const header = bytes.subarray(offset, offset + 512);
        const text = (start, size) => header.subarray(start, start + size).toString('utf8').split('\0')[0];
        const name = text(0, 100);
        if (!name) break;
        const prefix = text(345, 155);
        const size = parseInt(text(124, 12), 8);
        const start = offset + 512;
        entries.set(prefix ? `${prefix}/${name}` : name, bytes.subarray(start, start + size));
        offset = start + Math.ceil(size / 512) * 512;
    }
    return entries;
}

function generatorSmoke(command) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dsbuilder-generator-'));
    try {
        const sdds = path.join(temporary, '.sdds');
        const tenant = path.join(sdds, 'tenants', 'brand');
        const web = path.join(tenant, 'web');
        fs.mkdirSync(web, { recursive: true });
        fs.writeFileSync(path.join(sdds, 'tenants', 'palette.json'), '{"gray":{"1000":"#000000"}}');
        fs.writeFileSync(path.join(tenant, 'meta.json'), JSON.stringify({ name: 'brand', version: 'latest', tokens: [
            { type: 'color', name: 'dark.text.default.primary', tags: ['dark', 'text', 'default', 'primary'],
                displayName: 'textPrimary', description: '', enabled: true },
        ] }));
        fs.writeFileSync(path.join(web, 'web_color.json'), '{"dark.text.default.primary":"#FFFFFFFF"}');
        for (const type of ['gradient', 'shape', 'spacing', 'shadow', 'typography', 'fontFamily']) {
            fs.writeFileSync(path.join(web, `web_${type}.json`), '{}');
        }
        const env = { ...process.env };
        delete env.NPM_PACKAGE_SCOPE;
        delete env.NPM_TOKEN;
        delete env.NODE_AUTH_TOKEN;
        run(command, ['theme', '--sdds', sdds, '--out', path.join(temporary, 'output'), '--package', '--name', 'base'], { env, cwd: temporary });
        assert.equal(JSON.parse(fs.readFileSync(path.join(temporary, 'output', 'package.json'))).name, '@sddsjs/base');
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

if (require.main === module) {
    const [operation, first, second] = process.argv.slice(2);
    if (operation === 'verify') verify(path.resolve(first), second);
    else if (operation === 'pack') pack(path.resolve(first), path.resolve(second));
    else if (operation === 'smoke') smoke(path.resolve(first));
    else if (operation === 'generator-smoke') generatorSmoke(path.resolve(first));
    else throw new Error('Expected verify, pack or smoke');
}

module.exports = { verify, pack, smoke };
