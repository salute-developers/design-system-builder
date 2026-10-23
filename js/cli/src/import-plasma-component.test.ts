import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

const cliDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsx = join(cliDir, 'node_modules', '.bin', 'tsx');

/** Минимальный клон plasma: токены ядра и конфиг sdds-serv одного компонента. */
const writePlasma = (root: string) => {
    const core = join(root, 'packages/plasma-new-hope/src/components/Chip');
    const serv = join(root, 'packages/sdds-serv/src/components/Chip');
    mkdirSync(core, { recursive: true });
    mkdirSync(serv, { recursive: true });
    writeFileSync(
        join(core, 'Chip.tokens.ts'),
        `export const tokens = {
    background: '--plasma-chip-background',
    color: '--plasma-chip-color',
    height: '--plasma-chip-height',
    padding: '--plasma-chip-padding',
    borderRadius: '--plasma-chip-border-radius',
    fontFamily: '--plasma-chip-font-family',
    fontSize: '--plasma-chip-font-size',
    fontStyle: '--plasma-chip-font-style',
    fontWeight: '--plasma-chip-font-weight',
    letterSpacing: '--plasma-chip-letter-spacing',
    lineHeight: '--plasma-chip-line-height',
    disabledOpacity: '--plasma-chip-disabled-opacity',
};
`,
    );
    writeFileSync(join(core, 'Chip.tsx'), `export const chipRoot = { defaults: { view: 'default', size: 'm' } };\n`);
    writeFileSync(
        join(serv, 'Chip.config.ts'),
        `export const config = {
    defaults: {
        view: 'default',
        size: 'm',
    },
    variations: {
        view: {
            default: css\`
                \${tokens.background}: \${surfaceTransparentSecondary};
                \${tokens.color}: \${textPrimary};
            \`,
            accent: css\`
                \${tokens.background}: \${surfaceAccent};
                \${tokens.color}: \${textPrimary};
            \`,
        },
        size: {
            m: css\`
                \${tokens.height}: 2rem;
                \${tokens.padding}: 0.25rem 0.5rem;
                \${tokens.borderRadius}: 0.75rem;
                \${tokens.fontFamily}: \${bodyM.fontFamily};
                \${tokens.fontSize}: \${bodyM.fontSize};
                \${tokens.fontStyle}: \${bodyM.fontStyle};
                \${tokens.fontWeight}: \${bodyM.fontWeight};
                \${tokens.letterSpacing}: \${bodyM.letterSpacing};
                \${tokens.lineHeight}: \${bodyM.lineHeight};
            \`,
            l: css\`
                \${tokens.height}: 3rem;
                \${tokens.padding}: 0.25rem 1rem;
                \${tokens.borderRadius}: 1rem;
            \`,
        },
        disabled: {
            true: css\`
                \${tokens.disabledOpacity}: 0.4;
            \`,
        },
    },
};
`,
    );
    writeFileSync(join(serv, 'Chip.tsx'), `/** Чип. */\nexport const Chip = component(mergeConfig(chipConfig, config));\n`);
};

/** Локальная тема после `theme fetch`: имена токенов и web-значения формы. */
const writeTheme = (sdds: string, name = 'base_default') => {
    const theme = join(sdds, 'tenants', name);
    mkdirSync(join(theme, 'web'), { recursive: true });
    const token = (tokenName: string, type: string) => ({ name: tokenName, type });
    writeFileSync(
        join(theme, 'meta.json'),
        JSON.stringify({
            name,
            version: '0.1.0',
            tokens: [
                token('light.surface.default.transparent-secondary', 'color'),
                token('dark.surface.default.transparent-secondary', 'color'),
                token('light.surface.default.accent', 'color'),
                token('light.text.default.primary', 'color'),
                token('screen-s.body.m.normal', 'typography'),
                token('round.m', 'shape'),
                token('round.l', 'shape'),
            ],
        }),
    );
    writeFileSync(join(theme, 'web', 'web_shape.json'), JSON.stringify({ 'round.m': '0.75rem', 'round.l': '1rem' }));
};

const run = (sdds: string, plasma: string, ...args: string[]) =>
    spawnSync(tsx, [join(cliDir, 'src', 'import-plasma-component.ts'), '--component=Chip', `--plasma=${plasma}`, `--sdds=${sdds}`, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PLASMA_DIR: plasma },
    });

describe('import:plasma', () => {
    let root = '';
    let plasma = '';
    let sdds = '';
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'dsb-import-'));
        plasma = join(root, 'plasma');
        sdds = join(root, '.sdds');
        writePlasma(plasma);
        writeTheme(sdds);
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('dry run reports and writes nothing', () => {
        const result = run(sdds, plasma);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /Dry run/);
        assert.match(result.stdout, /Would write: .*chip_default_config\.json/);
        assert.equal(existsSync(join(sdds, 'components', 'meta.json')), false);
    });

    it('writes the package config by the model rules and templates into the generator manifest', () => {
        // Манифест генератора уходит во временную папку, настоящие шаблоны не трогаются.
        const templates = join(root, 'templates');
        const manifestDir = join(templates, 'Chip');
        const result = run(sdds, plasma, '--apply', `--templates=${templates}`);
        {
            assert.equal(result.status, 0, result.stdout + result.stderr);
            const meta = JSON.parse(readFileSync(join(sdds, 'components', 'meta.json'), 'utf8'));
            assert.deepEqual(meta.components, [{ componentName: 'chip', styleName: 'default', config: 'chip_default_config.json' }]);
            const config = JSON.parse(readFileSync(join(sdds, 'components', 'chip_default_config.json'), 'utf8'));
            // disabled — инвариант, а не вариация.
            assert.deepEqual(config.props, { disabledOpacity: { type: 'float', value: 0.4 } });
            assert.deepEqual(config.bindings, [
                { name: 'view', type: 'enum', values: ['default', 'accent'], defaultValue: 'default' },
                { name: 'size', type: 'enum', values: ['m', 'l'], defaultValue: 'm' },
            ]);
            const byId = Object.fromEntries(config.variations.map((v: { id: string; props: unknown }) => [v.id, v.props]));
            // Цвет по токену темы — в `default`; шрифтовая группа — одно свойство typography;
            // радиус совпал с токенами формы — shape; многозначный отступ — число стиля, шаблон в манифесте.
            assert.deepEqual(byId.default, {
                background: { type: 'color', default: 'surface.default.transparent-secondary' },
                color: { type: 'color', default: 'text.default.primary' },
            });
            assert.deepEqual(byId.m, {
                height: { type: 'dimension', value: 32 },
                padding: { type: 'dimension', value: 8 },
                borderRadius: { type: 'shape', value: 'round.m' },
                textStyle: { type: 'typography', value: 'body.m.normal' },
            });
            assert.deepEqual(byId.l.borderRadius, { type: 'shape', value: 'round.l' });
            assert.equal(JSON.stringify(config).includes('webTemplates'), false);
            const manifest = JSON.parse(readFileSync(join(manifestDir, 'component.json'), 'utf8'));
            assert.deepEqual(manifest.webTemplates, { padding: { padding: '0.25rem $1' } });
            // Повторный импорт без --remove перезаписывает записи компонента.
            const again = run(sdds, plasma, '--apply', `--templates=${templates}`);
            assert.equal(again.status, 0, again.stdout + again.stderr);
            assert.equal(JSON.parse(readFileSync(join(sdds, 'components', 'meta.json'), 'utf8')).components.length, 1);
            const removed = run(sdds, plasma, '--remove', '--apply');
            assert.equal(removed.status, 0, removed.stdout + removed.stderr);
            assert.equal(JSON.parse(readFileSync(join(sdds, 'components', 'meta.json'), 'utf8')).components.length, 0);
            assert.equal(existsSync(join(sdds, 'components', 'chip_default_config.json')), false);
        }
    });

    it('reports type mismatches with the web api meta and takes a shape token from --shape', () => {
        // Глобальный слой считает padding значением целиком, а borderRadius — формой с другими числами.
        mkdirSync(join(sdds, 'web'), { recursive: true });
        writeFileSync(
            join(sdds, 'web', 'web-api-meta.json'),
            JSON.stringify([
                { componentName: 'Chip', params: [{ paramName: 'padding', type: 'value', id: 'padding' }, { paramName: 'borderRadius', type: 'shape', id: 'borderRadius' }] },
            ]),
        );
        const result = run(sdds, plasma);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /ТРЕБУЕТ РЕШЕНИЯ[\s\S]*padding: тип dimension расходится с глобальным слоем \(padding: value\)/);
        assert.doesNotMatch(result.stdout, /borderRadius: тип/);

        // Радиус, не совпавший ни с одним round.*, с --shape остаётся формой с указанным токеном.
        const plasmaConfig = join(plasma, 'packages', 'sdds-serv', 'src', 'components', 'Chip', 'Chip.config.ts');
        writeFileSync(plasmaConfig, readFileSync(plasmaConfig, 'utf8').replace('0.75rem', '0.0625rem'));
        const plain = run(sdds, plasma);
        assert.match(plain.stdout, /borderRadius: 0.0625rem не совпадают ни с одним round\.\*/);
        assert.match(plain.stdout, /borderRadius: тип dimension расходится с глобальным слоем \(borderRadius: shape\); .*--shape=borderRadius=/);
        const forced = run(sdds, plasma, '--shape=borderRadius=round.l');
        assert.equal(forced.status, 0, forced.stdout + forced.stderr);
        assert.match(forced.stdout, /borderRadius: 0.0625rem заменены токеном round.l по --shape/);
        assert.doesNotMatch(forced.stdout, /borderRadius: тип/);
        const unknown = run(sdds, plasma, '--shape=borderRadius=round.nope');
        assert.notEqual(unknown.status, 0);
        assert.match(unknown.stdout + unknown.stderr, /round.nope/);
    });

    it('stops without a local theme and names theme fetch', () => {
        rmSync(join(sdds, 'tenants'), { recursive: true, force: true });
        const result = run(sdds, plasma);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /dsbuilder theme fetch/);
    });
});
