import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const home = process.env.USER ? `/Users/${process.env.USER}` : process.env.HOME;
const root = process.env.PLAYWRIGHT_BROWSERS_PATH || join(home, 'Library/Caches/ms-playwright');
let chromium =
    process.env.CHROMIUM_PATH ||
    spawnSync('find', [root, '-type', 'f', '-name', 'chrome-headless-shell'], { encoding: 'utf8' })
        .stdout.trim()
        .split('\n')[0];
if (!chromium || !existsSync(chromium)) throw new Error('Chromium is required; set CHROMIUM_PATH.');
const dist = new URL('../dist/', import.meta.url).pathname;
const project = {
    id: 'project-1',
    name: 'Очень длинное название проекта для проверки телефонной раскладки',
    description: 'Командная дизайн-платформа с длинным описанием',
    status: 'active',
    ownerUserId: 'owner-1',
    effectiveRole: 'owner',
};
const theme = {
    id: 'theme-1',
    designSystemId: 'ds-1',
    name: 'Корпоративная тема с длинным названием',
    editRevision: 0,
    colorConfig: { profile: 'sber' },
    preview: {
        accentLight: '#108E26',
        onAccentLight: '#fff',
        surfaceLight: '#fff',
        accentDark: '#1A9E32',
        surfaceDark: '#101010',
    },
};
const send = (res, value) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(value));
};
const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (path === '/api/projects') return send(res, [project]);
    if (path === '/api/projects/project-1') return send(res, project);
    if (path === '/api/projects/project-1/members')
        return send(res, [
            { userId: 'member-with-a-very-long-identifier', role: 'editor', createdAt: '', updatedAt: '' },
        ]);
    if (req.method === 'GET' && path === '/api/projects/project-1/access-keys')
        return send(res, [
            {
                id: 'key-1',
                projectId: 'project-1',
                name: 'CI production',
                scopes: ['projects:read', 'design-systems:read', 'tenants:read', 'tokens:read', 'components:read'],
                createdByUserId: 'owner-1',
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: '',
                updatedAt: '',
            },
        ]);
    if (path.endsWith('/tenants/theme-1/token-values')) return send(res, []);
    if (path.endsWith('/tenants/theme-1')) return send(res, theme);
    if (path.endsWith('/design-systems/ds-1/tokens')) return send(res, []);
    if (path.endsWith('/legacy/design-systems/Большая%20корпоративная%20дизайн-система/component-configs'))
        return send(res, []);
    if (path.includes('/design-systems/ds-1/tenants')) return send(res, [theme]);
    if (path.endsWith('/tenants/theme-1')) return send(res, theme);
    if (path.endsWith('/tenants/theme-1/token-values')) return send(res, []);
    if (path.endsWith('/design-systems/ds-1/tokens')) return send(res, []);
    if (path.includes('/legacy/design-systems/') && path.endsWith('/component-configs')) return send(res, []);
    if (path.endsWith('/design-systems'))
        return send(res, [
            {
                id: 'ds-1',
                projectId: 'project-1',
                name: 'Большая корпоративная дизайн-система',
                tenantCount: 1,
                themePreviews: [{ tenantId: 'theme-1', name: theme.name, preview: theme.preview }],
            },
        ]);
    if (path.endsWith('/design-systems/ds-1'))
        return send(res, {
            id: 'ds-1',
            projectId: 'project-1',
            name: 'Большая корпоративная дизайн-система',
            tenantCount: 1,
            themePreviews: [],
        });
    const requested = join(dist, path === '/' ? 'index.html' : path);
    const file = existsSync(requested) && !requested.endsWith('/') ? requested : join(dist, 'index.html');
    let body = readFileSync(file);
    if (file.endsWith('index.html'))
        body = Buffer.from(
            body
                .toString()
                .replace(
                    '</head>',
                    `<script>localStorage.setItem('auth.access_token','test');localStorage.setItem('auth.refresh_token','test');localStorage.setItem('auth.expires_at',Date.now()+3600000);setTimeout(()=>{const q=s=>document.querySelector(s),c=s=>getComputedStyle(q(s)),buttons=()=>[...document.querySelectorAll('button')],clickText=t=>buttons().find(b=>b.textContent.trim()===t)?.click(),mobile=innerWidth<=420;const x={rendered:!!q('.builder-shell')||location.pathname.includes('/themes/theme-1/'),realContent:document.body.textContent.includes('длинн')||!!q('form')||document.body.textContent.includes('@salutejs-ds/'),noHorizontalClip:document.documentElement.scrollWidth<=innerWidth};if(location.search.includes('sort-regression'))q('.catalog-sort-trigger')?.click();if(location.search.includes('review3-members')){clickText('Участники и роли');setTimeout(()=>clickText('Добавить участника'),30)}if(location.search.includes('review3-admin')){clickText('Администрирование');setTimeout(()=>clickText('Создать ключ'),30)}if(location.pathname.includes('/themes/theme-1/overview'))setTimeout(()=>buttons()[1]?.click(),30);setTimeout(()=>{if(q('.catalog-grid')&&!location.search.includes('sort-regression')){const grid=q('.catalog-grid'),style=c('.catalog-grid'),tracks=style.gridTemplateColumns.split(' '),gap=parseFloat(style.columnGap);x.catalogColumns=mobile?tracks.length===1:tracks.length===Math.floor((grid.clientWidth+gap)/(330+gap))&&tracks.every(track=>track==='330px');x.catalogTrackWidth=mobile||tracks.every(track=>track==='330px');const title=q('.catalog-card h2'),card=title?.closest('.catalog-card'),tr=title?.getBoundingClientRect(),cr=card?.getBoundingClientRect();if(title){x.cardTitleVisible=c('.catalog-card h2').visibility==='visible'&&c('.catalog-card h2').display!=='none'&&tr.height>0;x.cardTitleInside=tr.top>=cr.top&&tr.bottom<=cr.bottom&&tr.left>=cr.left&&tr.right<=cr.right}}if(q('.project-settings')){x.settingsColumns=c('.project-settings').gridTemplateColumns.split(' ').length===(mobile?1:3);x.settingsNavigation=!!q('.ps-nav button');x.settingsAside=mobile?c('.ps-aside').display==='none':c('.ps-aside').display!=='none'}if(q('.entity-dialog'))x.dialogFits=q('.entity-dialog').getBoundingClientRect().width<=innerWidth-20;if(q('.create-theme-workspace'))x.themeColumns=c('.create-theme-workspace').gridTemplateColumns.split(' ').length===(mobile?1:2);if(location.pathname.includes('/themes/theme-1/')){const content=[...document.querySelectorAll('*')].find(e=>e.textContent.trim().startsWith('@salutejs-ds/')),rect=content?.getBoundingClientRect();x.editorLoaded=!document.body.textContent.includes('Загружаем Theme…')&&!q('[role="alert"]');x.editorContentInViewport=!!rect&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth;x.editorSectionNavigation=location.pathname.endsWith('/colors')}if(location.search.includes('review3-members')){const head=[...document.querySelectorAll('.ps-members-head span')].map(e=>e.getBoundingClientRect()),row=[...document.querySelector('.ps-member-row').children].map(e=>e.getBoundingClientRect());x.singleAddMember=buttons().filter(b=>b.textContent.trim()==='Добавить участника').length===1;x.memberColumnsAligned=head.length===4&&row.length===4&&[1,2].every(i=>Math.abs(head[i].left-row[i].left)<2);x.styledRoleSelector=!!q('.ps-member-row .styled-select-trigger')&&!q('.ps-member-row select');x.addMemberModalFits=!!q('.modal')&&q('.modal').getBoundingClientRect().bottom<=innerHeight&&q('.modal').getBoundingClientRect().top>=0;x.unsupportedMediaAbsent=!/Иконка проекта|Обложка проекта|Загрузить изображение|Загрузить обложку/.test(document.body.textContent)}if(location.search.includes('review3-admin')){const modal=q('.modal'),body=q('.ps-access-key-modal-body'),footer=q('.ps-access-key-modal footer'),chips=[...document.querySelectorAll('.ps-cli-row .ps-scope-chip')],flow=q('.ps-cli-row .ps-scope-flow');x.accessKeyModalFits=!!modal&&modal.getBoundingClientRect().top>=0&&modal.getBoundingClientRect().bottom<=innerHeight;x.accessKeyInnerScroll=!!body&&['auto','scroll'].includes(getComputedStyle(body).overflowY)&&body.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top;x.scopeChipsWrap=chips.length===5&&chips.every(chip=>chip.getBoundingClientRect().top>flow.getBoundingClientRect().top&&chip.getBoundingClientRect().bottom<flow.getBoundingClientRect().bottom)}if(location.search.includes('sort-regression')){const items=[...document.querySelectorAll('.catalog-sort-menu button')],styles=items.map(getComputedStyle),rects=items.map(item=>item.getBoundingClientRect());x.sortMenuWidth=c('.catalog-sort-menu').width==='125px';x.sortHasEveryItem=items.length===3;x.sortItemStyles=styles.every(style=>style.whiteSpace==='nowrap'&&style.overflowX==='hidden'&&style.overflowY==='hidden'&&style.textOverflow==='ellipsis'&&style.height==='22px');x.sortNoVerticalTextOverflow=items.every(item=>item.scrollHeight<=item.clientHeight);x.sortItemsDoNotOverlap=rects.every((rect,index)=>index===0||rect.top>=rects[index-1].bottom)}const o=document.createElement('output');o.id='browser-result';o.textContent=JSON.stringify(x);document.body.append(o)},120)},1200)</script></head>`,
                ),
        );
    res.setHeader(
        'content-type',
        { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] || 'text/html',
    );
    res.end(body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
for (const [route, width, height] of [
    ['/projects', 390, 844],
    ['/projects?sort-regression=1', 1440, 900],
    ['/projects/new', 390, 844],
    ['/projects/project-1/settings', 390, 844],
    ['/projects/project-1/design-systems/new', 390, 844],
    ['/projects/project-1/design-systems/ds-1/themes/new', 390, 844],
    ['/projects', 1440, 900],
    ['/projects/project-1/settings', 1440, 900],
    ['/projects/project-1/settings?review3-members=1', 1440, 900],
    ['/projects/project-1/settings?review3-admin=1', 1440, 900],
    ['/projects/project-1/design-systems/ds-1', 1440, 720],
    ['/projects/project-1/design-systems/ds-1/themes/new', 1440, 900],
]) {
    const output = await new Promise((resolve, reject) => {
        const child = spawn(chromium, [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--single-process',
            '--no-zygote',
            `--window-size=${width},${height}`,
            '--virtual-time-budget=2500',
            '--dump-dom',
            `http://127.0.0.1:${port}${route}`,
        ]);
        let out = '',
            err = '';
        child.stdout.on('data', (c) => (out += c));
        child.stderr.on('data', (c) => (err += c));
        child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err))));
    });
    const match = output.match(/<output id="browser-result">([^<]+)<\/output>/);
    if (!match) throw new Error(`${route}: missing React assertions`);
    const checks = JSON.parse(match[1].replaceAll('&quot;', '"')),
        failed = Object.entries(checks)
            .filter(([, v]) => !v)
            .map(([k]) => k);
    if (failed.length) throw new Error(`${route}: ${failed.join(', ')}`);
    console.log(route, checks);
}
server.close();
