/* global Buffer, URL, console, fetch, process */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const requireRealStack = process.argv.includes('--require-real-stack');
const apiBaseUrl = process.env.LAYOUT_TEST_API_BASE_URL?.replace(/\/$/, '');
const existingEditorPath = process.env.LAYOUT_TEST_EDITOR_PATH;
const existingCatalogPath = process.env.LAYOUT_TEST_THEME_CATALOG_PATH;
const configuredAccessToken = process.env.LAYOUT_TEST_ACCESS_TOKEN;
const realStackInputs = [apiBaseUrl, existingEditorPath, existingCatalogPath, configuredAccessToken];
const realStackMode = realStackInputs.every(Boolean);
if ((requireRealStack || realStackInputs.some(Boolean)) && !realStackMode) {
    throw new Error(
        'Existing-tenant browser regression requires LAYOUT_TEST_API_BASE_URL, LAYOUT_TEST_EDITOR_PATH, ' +
            'LAYOUT_TEST_THEME_CATALOG_PATH, and LAYOUT_TEST_ACCESS_TOKEN.',
    );
}

const userHome = process.env.USER ? `/Users/${process.env.USER}` : process.env.HOME;
const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || join(userHome, 'Library/Caches/ms-playwright');
const chromium =
    process.env.CHROMIUM_PATH ||
    spawnSync('find', [browserRoot, '-type', 'f', '-name', 'chrome-headless-shell'], { encoding: 'utf8' })
        .stdout.trim()
        .split('\n')[0];
if (!chromium || !existsSync(chromium)) throw new Error('Chromium is required; set CHROMIUM_PATH.');

const dist = new URL('../dist/', import.meta.url).pathname;
const accessToken = configuredAccessToken || 'test';
const project = {
    id: 'project-1',
    name: 'Project',
    description: '',
    status: 'active',
    ownerUserId: 'owner-1',
    effectiveRole: 'viewer',
};
const designSystem = {
    id: 'ds-1',
    projectId: project.id,
    name: 'Existing Design System',
    tenantCount: 1,
    themePreviews: [],
};
const theme = {
    id: 'theme-1',
    designSystemId: designSystem.id,
    name: 'Existing corporate theme with a deliberately very long visible name',
    editRevision: 0,
    colorConfig: { profile: 'sber' },
    preview: {
        accentLight: '#108E26',
        onAccentLight: '#FFFFFF',
        surfaceLight: '#FFFFFF',
        accentDark: '#1A9E32',
        surfaceDark: '#101010',
    },
};
const token = {
    id: 'token-1',
    designSystemId: designSystem.id,
    name: 'surface.default.accent',
    type: 'color',
    displayName: 'Accent',
    description: null,
    enabled: true,
};
const tokenValues = ['web', 'ios', 'android'].flatMap((platform) =>
    ['light', 'dark'].map((mode) => ({
        tokenId: token.id,
        tenantId: theme.id,
        platform,
        mode,
        value: mode === 'light' ? '#108E26' : '#1A9E32',
    })),
);

const send = (res, value) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(value));
};
const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    if (process.env.DEBUG_LAYOUT) console.error(req.method, req.url);
    if (realStackMode && path.startsWith('/api/')) {
        const upstream = await fetch(`${apiBaseUrl}${req.url}`, {
            headers: { authorization: `Bearer ${accessToken}`, accept: req.headers.accept || 'application/json' },
        });
        res.statusCode = upstream.status;
        res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
    }
    if (!realStackMode && path.startsWith('/api/')) {
        if (path === '/api/projects') return send(res, [project]);
        if (path === '/api/projects/project-1') return send(res, project);
        if (path.endsWith('/design-systems/ds-1/tenants')) return send(res, [theme]);
        if (path.endsWith('/design-systems/ds-1/tokens')) return send(res, [token]);
        if (path.endsWith('/design-systems/ds-1')) return send(res, designSystem);
        if (path.endsWith('/tenants/theme-1/token-values')) return send(res, tokenValues);
        if (path.endsWith('/tenants/theme-1')) return send(res, theme);
        if (path.includes('/legacy/design-systems/Existing%20Design%20System/component-configs')) return send(res, []);
    }

    const requested = join(dist, path === '/' ? 'index.html' : path);
    const file = existsSync(requested) && !requested.endsWith('/') ? requested : join(dist, 'index.html');
    let body = readFileSync(file);
    if (file.endsWith('index.html')) {
        body = Buffer.from(
            body.toString().replace(
                '</head>',
                `<script>
                    localStorage.setItem('auth.access_token', ${JSON.stringify(accessToken)});
                    localStorage.setItem('auth.refresh_token', ${JSON.stringify(accessToken)});
                    localStorage.setItem('auth.expires_at', Date.now() + 3600000);
                    setTimeout(() => {
                        const isEditor = location.pathname.includes('/themes/');
                        const expectedSection = isEditor ? location.pathname.split('/').filter(Boolean).at(-1) : null;
                        const checks = { existingTenantRoute: !isEditor || location.pathname.includes('/themes/') };
                        const card = document.querySelector('.catalog-card');
                        const title = card?.querySelector('h2');
                        checks.cardPresent = isEditor || Boolean(card);
                        checks.cardTitlePresent = isEditor || Boolean(title);
                        if (!isEditor && card && title) {
                            const cardRect = card.getBoundingClientRect();
                            const titleRect = title.getBoundingClientRect();
                            const titleStyle = getComputedStyle(title);
                            checks.cardRect = JSON.stringify({ top: cardRect.top, bottom: cardRect.bottom, height: cardRect.height });
                            checks.titleRect = JSON.stringify({ top: titleRect.top, bottom: titleRect.bottom, height: titleRect.height });
                            checks.titleInsideCard = titleRect.top >= cardRect.top && titleRect.bottom <= cardRect.bottom;
                            checks.titleVisible = titleRect.width > 0 && titleRect.height > 0 && titleStyle.visibility !== 'hidden';
                            checks.titleEllipsis = titleStyle.textOverflow === 'ellipsis' && title.scrollWidth > title.clientWidth;
                        }
                        const menu = document.querySelector('[data-testid="editor-workspace-menu"]');
                        const content = document.querySelector('[data-testid="editor-workspace-content"]');
                        const rail = document.querySelector('[data-testid="editor-rail"]');
                        const railLogo = rail?.firstElementChild;
                        const railButton = rail?.querySelector('[data-testid="editor-nav-colors"]');
                        const railIcon = railButton?.querySelector('svg');
                        const sectionContent = content?.firstElementChild;
                        checks.workspacePresent = !isEditor || Boolean(menu && content);
                        checks.railPresent = !isEditor || Boolean(rail && railLogo && railButton && railIcon);
                        checks.sectionContentPresent = !isEditor || content?.dataset.editorSection === expectedSection;
                        checks.renderedSectionPresent = !isEditor || Boolean(sectionContent);
                        if (isEditor && rail && railLogo && railButton && railIcon) {
                            const railRect = rail.getBoundingClientRect();
                            const railLogoRect = railLogo.getBoundingClientRect();
                            const railButtonRect = railButton.getBoundingClientRect();
                            const railIconRect = railIcon.getBoundingClientRect();
                            checks.railRect = JSON.stringify({ left: railRect.left, width: railRect.width, height: railRect.height });
                            checks.railLogoRect = JSON.stringify({ left: railLogoRect.left, top: railLogoRect.top, width: railLogoRect.width, height: railLogoRect.height });
                            checks.railButtonRect = JSON.stringify({ left: railButtonRect.left, width: railButtonRect.width, height: railButtonRect.height });
                            checks.railIconRect = JSON.stringify({ left: railIconRect.left, top: railIconRect.top, width: railIconRect.width, height: railIconRect.height });
                            checks.railGeometry = railRect.left === 0 && railRect.width === 44 && railRect.height === innerHeight;
                            checks.railLogoGeometry = railLogoRect.left === 6 && railLogoRect.top === 6 && railLogoRect.width === 32 && railLogoRect.height === 32;
                            checks.railButtonGeometry = railButtonRect.left === 6 && railButtonRect.top === 84 && railButtonRect.width === 32 && railButtonRect.height === 32;
                            checks.railIconGeometry = railIconRect.width === 16 && railIconRect.height === 16 && railIconRect.left === railButtonRect.left + 8 && railIconRect.top === railButtonRect.top + 8;
                        }
                        if (isEditor && rail && railLogo && railButton && menu && content && sectionContent) {
                            const railRect = rail.getBoundingClientRect();
                            const menuRect = menu.getBoundingClientRect();
                            const contentRect = content.getBoundingClientRect();
                            const sectionRect = sectionContent.getBoundingClientRect();
                            checks.menuRect = JSON.stringify({ top: menuRect.top, bottom: menuRect.bottom, height: menuRect.height });
                            checks.contentRect = JSON.stringify({ top: contentRect.top, bottom: contentRect.bottom, height: contentRect.height });
                            checks.sectionRect = JSON.stringify({ top: sectionRect.top, bottom: sectionRect.bottom, height: sectionRect.height });
                            checks.menuFollowsRail = menuRect.left === railRect.right;
                            checks.contentFollowsMenu = contentRect.left === menuRect.right;
                            checks.menuFillsViewport = menuRect.top === 0 && menuRect.bottom === innerHeight && menuRect.height === innerHeight;
                            checks.contentFillsViewport = contentRect.top === 0 && contentRect.bottom === innerHeight && contentRect.height === innerHeight;
                            checks.contentVisible = contentRect.width > 0 && contentRect.height > 0 && getComputedStyle(content).visibility !== 'hidden';
                            checks.sectionInsideViewport = sectionRect.top >= 0 && sectionRect.top < innerHeight && sectionRect.bottom <= innerHeight;
                            checks.sectionVisible = sectionRect.width > 0 && sectionRect.height > 0 && getComputedStyle(sectionContent).visibility !== 'hidden';
                            checks.alertText = JSON.stringify(Array.from(document.querySelectorAll('[role="alert"]'), (node) => node.textContent));
                            checks.loadedExistingTenant = !document.body.textContent.includes('Загружаем Theme') && !document.querySelector('[role="alert"]');
                            checks.readOnlyPreserved = document.body.textContent.includes('Режим просмотра');
                            checks.nativeReadOnly = menu.inert === true && content.inert === true;
                            if (expectedSection === 'overview') {
                                const editTarget = content.querySelector('input, textarea, button, [contenteditable="true"]');
                                checks.editTargetPresent = Boolean(editTarget);
                                if (editTarget) {
                                    const stateBefore = 'value' in editTarget ? editTarget.value : editTarget.textContent;
                                    editTarget.focus();
                                    document.execCommand('insertText', false, 'read-only-regression');
                                    const stateAfter = 'value' in editTarget ? editTarget.value : editTarget.textContent;
                                    checks.keyboardFocusBlocked = document.activeElement !== editTarget;
                                    checks.editorStateUnchanged = stateBefore === stateAfter;
                                }
                            }
                        }
                        if (location.search.includes('navigate-colors')) {
                            document.querySelector('[data-testid="editor-nav-colors"]')?.click();
                            setTimeout(() => {
                                checks.sectionNavigation = location.pathname.endsWith('/colors');
                                emit(checks);
                            }, 100);
                            return;
                        }
                        emit(checks);
                    }, 1600);
                    function emit(checks) {
                        const output = document.createElement('output');
                        output.id = 'layout-browser-result';
                        output.textContent = JSON.stringify(checks);
                        document.body.append(output);
                    }
                </script></head>`,
            ),
        );
    }
    res.setHeader(
        'content-type',
        { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] || 'text/html',
    );
    res.end(body);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const editor = existingEditorPath || '/projects/project-1/design-systems/ds-1/themes/theme-1';
const catalog = existingCatalogPath || '/projects/project-1/design-systems/ds-1';
const cases = [
    [catalog, 1440, 900],
    [`${editor}/overview?navigate-colors=1`, 1280, 720],
    ...(realStackMode
        ? [
              [`${editor}/colors`, 1280, 720],
              [`${editor}/shapes`, 1280, 720],
              [`${editor}/typography`, 1280, 720],
              [`${editor}/components`, 1280, 720],
          ]
        : []),
];

for (const [route, width, height] of cases) {
    const output = await new Promise((resolve, reject) => {
        const child = spawn(chromium, [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--single-process',
            '--no-zygote',
            `--window-size=${width},${height}`,
            '--virtual-time-budget=8000',
            '--dump-dom',
            `http://127.0.0.1:${port}${route}`,
        ]);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (code) => {
            if (process.env.DEBUG_LAYOUT && stderr) console.error(stderr);
            return code === 0 ? resolve(stdout) : reject(new Error(stderr));
        });
    });
    const match = output.match(/<output id="layout-browser-result">([^<]+)<\/output>/);
    if (!match) throw new Error(`${route}: missing layout assertions; DOM tail: ${output.slice(-2000)}`);
    const checks = JSON.parse(match[1].replaceAll('&quot;', '"'));
    const required = route.includes('/themes/')
        ? [
              'railPresent',
              'railRect',
              'railLogoRect',
              'railButtonRect',
              'railIconRect',
              'railGeometry',
              'railLogoGeometry',
              'railButtonGeometry',
              'railIconGeometry',
              ...(route.includes('navigate-colors') ? ['sectionNavigation'] : []),
              'workspacePresent',
              'sectionContentPresent',
              'renderedSectionPresent',
              'menuFollowsRail',
              'contentFollowsMenu',
              'menuRect',
              'contentRect',
              'sectionRect',
              'menuFillsViewport',
              'contentFillsViewport',
              'contentVisible',
              'sectionInsideViewport',
              'sectionVisible',
              'loadedExistingTenant',
              ...(realStackMode
                  ? [
                        'readOnlyPreserved',
                        'nativeReadOnly',
                        ...(route.includes('/overview')
                            ? ['editTargetPresent', 'keyboardFocusBlocked', 'editorStateUnchanged']
                            : []),
                    ]
                  : []),
          ]
        : [
              'cardPresent',
              'cardTitlePresent',
              'cardRect',
              'titleRect',
              'titleInsideCard',
              'titleVisible',
              'titleEllipsis',
          ];
    const missing = required.filter((name) => !(name in checks));
    if (missing.length)
        throw new Error(`${route}: missing assertions ${missing.join(', ')}; ${JSON.stringify(checks)}`);
    const failed = Object.entries(checks)
        .filter(([name, value]) => required.includes(name) && !name.endsWith('Rect') && value !== true)
        .map(([name]) => name);
    if (failed.length) throw new Error(`${route}: ${failed.join(', ')}; ${JSON.stringify(checks)}`);
    console.log(route, checks);
}
server.close();
