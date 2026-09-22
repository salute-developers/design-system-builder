/**
 * Импорт web-компонента в prod-сиды из репозитория plasma.
 *
 * Источники:
 *   - API компонента: `packages/plasma-new-hope/src/components/<X>/<X>.tokens.ts` (ключи `tokens`);
 *   - конфиг оформления: `packages/sdds-serv/src/components/<X>/<X>.config.ts(x)`;
 *   - имена токенов темы базовой ДС: `seeds/prod/tokens.ts`.
 *
 * Usage:
 *   npx tsx src/db/import-plasma-component.ts --component=TextArea [--plasma=~/work/plasma]
 *       [--config=<file>] [--tokens=<file>] [--alias=identInConfig=token.name.in.base ...]
 *       [--apply]
 *   npx tsx src/db/import-plasma-component.ts --component=TextArea --remove --apply
 *   npx tsx src/db/import-plasma-component.ts --component=Tabs --dir=<sdds>/components/Tabs \
 *       --tokens=<core>/components/Tabs/tokens.ts [--root=orientation] [--apply]
 *       (подпапки horizontal/, vertical/ — appearance)
 *
 * Импорт пишет папку `seeds/prod/components/<имя>/` целиком, `--remove` её удаляет, чтобы импорт
 * можно было повторить после правок. Дочерние компоненты и связи `component_deps.ts` при этом
 * не трогаются. Без `--apply` только печатает отчёт.
 *
 * Составной компонент (`--dir`): подпапки — appearance (horizontal/vertical), файл
 * `<Appearance><Element>.config.ts` — конфиг элемента в этом appearance. Элемент с именем
 * `--component` — родитель, остальные — дочерние через `component_deps` (compose). У всех appearance
 * общие токены, вариации и стили, но свой состав вариаций, свои дефолты и значения; проп, по
 * которому обёртка пакета выбирает appearance (`--root`, по умолчанию `orientation`), уходит в
 * манифест генератора. Скрипт не ходит в БД и не зависит от node_modules
 * db-service: запускать с хоста, где есть клон plasma. Всё, что нельзя выразить в модели
 * однозначно, попадает в отчёт со статусом, а не в сиды.
 *
 * Правила модели (см. docs/component-creation.md, раздел «Импорт из plasma»):
 *   - имя web-параметра свойства равно ключу объекта токенов ядра;
 *   - шесть токенов шрифта группируются в одно свойство `typography` `<prefix>Style`;
 *   - радиус сначала сверяется с токенами формы `round.*`: совпали все значения — `shape`,
 *     иначе всё свойство уходит в `dimension`;
 *   - многозначное CSS-значение выражается одним шаблоном web-параметра на свойство;
 *   - вариации `disabled` и `readOnly` не вариации: их токены уходят в инварианты;
 *   - несколько appearance заводятся только из папок (`--dir`); соседний конфиг `X.clear.config.ts` попадает в отчёт;
 *   - defaults берутся из конфига темы; для вариаций без дефолта подставляются defaults ядра,
 *     если такой стиль есть в теме.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { componentDirName, type AppearanceSeed, type ComponentSeed, type ValueSeed, type ValuesSeed } from './seeds/prod/component-seed';
import { writeComponentSeed } from './seeds/prod/component-seed-writer';

// ─── File helpers ────────────────────────────────────────────────────────────

/** Строковый литерал в одинарных кавычках. */
function esc(s: string | null | undefined): string {
    if (s === null || s === undefined) return "''";
    return `'${s.replace(/'/g, "\\'")}'`;
}

/** Вставить `addition` перед первым совпадением `regex`; без совпадения — ошибка с меткой. */
function insertBeforeRegex(content: string, regex: RegExp, addition: string, label: string): string {
    const match = regex.exec(content);
    if (!match) throw new Error(`Anchor not found for: ${label}`);
    return content.slice(0, match.index) + addition + content.slice(match.index);
}

/**
 * Правка файлов вне папки компонента (манифест генератора, список связей) с сухим прогоном:
 * без `--apply` ничего не пишется, действия только печатаются.
 */
class SeedPatcher {
    constructor(private readonly dryRun = false) {}

    patchFile(filePath: string, patcher: (content: string) => string) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const patched = patcher(content);
        if (patched === content) {
            console.log(`  Skipped (already patched): ${path.basename(filePath)}`);
            return;
        }
        if (!this.dryRun) fs.writeFileSync(filePath, patched);
        console.log(`  ${this.dryRun ? 'Would patch' : 'Patched'}: ${path.basename(filePath)}`);
    }

    deleteFile(filePath: string) {
        if (!this.dryRun) fs.rmSync(filePath, { force: true });
        console.log(`  ${this.dryRun ? 'Would delete' : 'Deleted'}: ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);
    }

    writeFile(filePath: string, content: string) {
        if (!this.dryRun) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content);
        }
        console.log(`  ${this.dryRun ? 'Would create' : 'Created'}: ${path.relative(path.dirname(path.dirname(filePath)), filePath)}`);
    }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

type Args = {
    component: string;
    plasma: string;
    config?: string;
    tokens?: string;
    /** Папка с конфигами составного компонента: `<appearance>/<Appearance><Element>.config.ts`. */
    dir?: string;
    /** Проп, по которому обёртка выбирает appearance в режиме `--dir` (по умолчанию orientation). */
    root: string;
    aliases: Map<string, string>;
    /** Стили `<вариация>.<стиль>`, которые не переносятся: значения не выражаются моделью (Avatar size.fit). */
    skipStyles: Set<string>;
    apply: boolean;
    remove: boolean;
    /** Только пересобрать манифест генератора по sdds-serv, сиды не трогать. */
    manifest: boolean;
    /** Папка компонента в sdds-serv и ядре, если она не совпадает с именем (Segment → SegmentGroup, Typography → Body). */
    dirName?: string;
    /** Дефолты вариаций поверх конфига темы: `--default=size=m`. */
    defaultsOverride: Record<string, string>;
};

function parseArgs(): Args {
    const get = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
    const component = get('component');
    if (!component) {
        console.error('Usage: npx tsx src/db/import-plasma-component.ts --component=TextArea [--plasma=<dir>] [--apply]');
        process.exit(1);
    }
    const aliases = new Map<string, string>();
    for (const a of process.argv.filter((x) => x.startsWith('--alias='))) {
        const [ident, token] = a.slice('--alias='.length).split('=');
        if (ident && token) aliases.set(ident, token);
    }
    const skipStyles = new Set(
        process.argv.filter((x) => x.startsWith('--skip-style=')).flatMap((x) => x.slice('--skip-style='.length).split(',')).filter(Boolean),
    );
    const plasmaRaw = get('plasma') ?? process.env.PLASMA_DIR ?? '~/Documents/work/plasma';
    return {
        component,
        plasma: plasmaRaw.replace(/^~/, os.homedir()),
        config: get('config'),
        tokens: get('tokens'),
        dir: get('dir')?.replace(/^~/, os.homedir()),
        root: get('root') ?? 'orientation',
        aliases,
        skipStyles,
        apply: process.argv.includes('--apply'),
        remove: process.argv.includes('--remove'),
        manifest: process.argv.includes('--manifest'),
        dirName: get('dir-name'),
        defaultsOverride: Object.fromEntries(
            process.argv.filter((x) => x.startsWith('--default=')).map((x) => x.slice('--default='.length).split('=') as [string, string]),
        ),
    };
}

// ─── Report ──────────────────────────────────────────────────────────────────

type ReportEntry = { kind: 'decision' | 'approx' | 'skip' | 'info'; text: string };
const report: ReportEntry[] = [];
const note = (kind: ReportEntry['kind'], text: string) => report.push({ kind, text });

// ─── Sources ─────────────────────────────────────────────────────────────────

/** Токены ядра: ключ -> имя CSS-переменной (`itemPadding` -> `--plasma-segment-item-padding`). */
function readCoreTokens(file: string): Map<string, string> {
    const src = fs.readFileSync(file, 'utf-8');
    const m = /export const tokens\s*=\s*\{([\s\S]*?)\n\};/.exec(src);
    if (!m) throw new Error(`No 'export const tokens' block in ${file}`);
    return new Map([...m[1].matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map((x) => [x[1], x[2]] as const));
}
/** Переменные ядра текущего компонента — для ссылок `var(${tokens.x})` внутри значений. */
let coreVarByKey = new Map<string, string>();

function readBaseThemeTokens(seedsDir: string): Map<string, string> {
    const src = fs.readFileSync(path.join(seedsDir, 'tokens.ts'), 'utf-8');
    const byName = new Map<string, string>();
    for (const m of src.matchAll(/\{ name: '([^']+)', type: '(\w+)'/g)) {
        const name = m[1].replace(/^(dark|light|screen-[a-z]+)\./, '');
        byName.set(name, m[2]);
    }
    return byName;
}

/** Веб-значения токенов формы базовой ДС в пикселях: `round.m` -> 12. */
function readShapeTokenPx(seedsDir: string): Map<string, number> {
    const src = fs.readFileSync(path.join(seedsDir, 'token_values', 'shape.ts'), 'utf-8');
    const byName = new Map<string, number>();
    for (const m of src.matchAll(/'([^']+)':\s*\{\s*web:\s*"([^"]+)"/g)) {
        if (NUM.test(m[2])) byName.set(m[1], toPx(m[2]));
    }
    return byName;
}

type Parsed = {
    defaults: Record<string, string>;
    order: string[];
    variations: Record<string, Record<string, [string, string][]>>;
};

function parseDefaultsBlock(src: string): Record<string, string> {
    const defaults: Record<string, string> = {};
    const dm = /defaults:\s*\{([\s\S]*?)\}/.exec(src);
    if (dm) for (const m of dm[1].matchAll(/(\w+):\s*'(\w+)'/g)) defaults[m[1]] = m[2];
    return defaults;
}

function parseConfig(file: string): Parsed {
    const cfg = fs.readFileSync(file, 'utf-8');
    const defaults = parseDefaultsBlock(cfg);
    // Локальный алиас объекта токенов (`avatarTokens as tokens`): ссылки на него внутри значений
    // (`calc(var(${tokens.avatarSize}) …)`) переписываются на настоящее имя экспорта ядра,
    // иначе сгенерированный конфиг сослался бы на несуществующий `tokens`.
    const tokensAlias = /(\w+Tokens)\s+as\s+tokens\b/.exec(cfg)?.[1];
    const normalize = (raw: string) => (tokensAlias ? raw.replace(/\$\{tokens\./g, `\${${tokensAlias}.`) : raw);

    const variations: Parsed['variations'] = {};
    const order: string[] = [];
    let curVar: string | null = null;
    let curStyle: string | null = null;
    let inVars = false;
    // Стиль, перед которым стоит `// deprecated` или JSDoc с `@deprecated`, не переносится:
    // sdds-serv держит его для совместимости, в ДС ему делать нечего.
    let deprecated = false;
    // `intersections` (Steps): значения на пересечении двух вариаций. Модель хранит такие сочетания
    // только под корневой вариацией, поэтому блок пропускается с пометкой.
    const intersections = (cfg.match(/^\s{4}intersections:\s*\[/m) ? cfg.match(/^\s{12}style:\s*css`/gm)?.length : 0) ?? 0;
    if (intersections) note('skip', `intersections: ${intersections} пересечений вариаций не перенесены, модель не хранит сочетания без корневой вариации`);
    for (const line of cfg.split('\n')) {
        if (/^\s{4}variations:\s*\{/.test(line)) { inVars = true; continue; }
        // Следующий ключ конфига верхнего уровня (`intersections`, `defaults`) закрывает вариации.
        if (inVars && /^\s{4}\w+:/.test(line)) { inVars = false; curVar = null; curStyle = null; continue; }
        if (!inVars) continue;
        if (/^\s*(\/\/|\*|\/\*\*).*deprecated/i.test(line)) { deprecated = true; continue; }
        const mv = /^\s{8}(\w+):\s*\{\s*$/.exec(line);
        if (mv) {
            // Несколько конфигов в одном файле (Typography: configL, configM, …) складываются в одну вариация.
            curVar = mv[1];
            variations[curVar] = variations[curVar] ?? {};
            if (!order.includes(curVar)) order.push(curVar);
            deprecated = false;
            continue;
        }
        const ms = /^\s{12}(\w+):\s*css`(`,)?\s*$/.exec(line);
        if (ms && curVar) {
            if (deprecated) {
                deprecated = false;
                note('skip', `${curVar}.${ms[1]}: стиль помечен deprecated в конфиге, не перенесён`);
                curStyle = null;
                continue;
            }
            curStyle = ms[1]; variations[curVar][curStyle] = []; if (ms[2]) curStyle = null; continue;
        }
        if (/^\s{12}`,\s*$/.test(line)) { curStyle = null; continue; }
        // Ключ токена: `${tokens.x}` или `${<alias>Tokens.x}` (Tabs пишут `${tabsTokens.x}`).
        // Хвостовой комментарий после значения (`1rem 1.5rem; /* 1.625 */`) не часть значения.
        const mt = /^\s*\$\{(?:tokens|\w+Tokens)\.(\w+)\}:\s*(.*);\s*(?:\/\*.*\*\/|\/\/.*)?\s*$/.exec(line);
        if (mt && curVar && curStyle) {
            // Ключ может повторяться внутри одного стиля: сначала общая часть (вставка вроде
            // `${baseItemView}`), потом переопределение своим цветом. В CSS побеждает последнее
            // значение, поэтому прежнее заменяем, а не копим оба.
            const items = variations[curVar][curStyle];
            const value = normalize(mt[2]);
            const at = items.findIndex(([key]) => key === mt[1]);
            if (at >= 0) items[at] = [mt[1], value];
            else items.push([mt[1], value]);
        }
    }
    addCounterpartStyles(defaults, variations);
    return { defaults, order, variations };
}

/** Парный стиль для корневой вариации с единственным стилем: `vertical` -> `horizontal`. */
const COUNTERPART_STYLE: Record<string, string> = { vertical: 'horizontal', horizontal: 'vertical' };

/**
 * sdds-serv описывает у ориентации только один вариант (`orientation: { vertical }`), второй
 * подразумевается ядром. В билдере вариация с одним стилем не переключается назад, поэтому парный
 * стиль заводится пустым и становится значением по умолчанию. Флаги (`pilled: { true }`) парного
 * стиля не получают: как в ядре, у флага один стиль `true`, а выключенное состояние — отсутствие
 * дефолта; ключ `false` в конфиге сломал бы boolean-тип пропа.
 */
function addCounterpartStyles(defaults: Record<string, string>, variations: Parsed['variations']) {
    for (const [axis, styles] of Object.entries(variations)) {
        const names = Object.keys(styles);
        if (names.length !== 1 || defaults[axis] || STATE_AXES.has(axis)) continue;
        const pair = COUNTERPART_STYLE[names[0]];
        if (!pair) continue;
        variations[axis] = { [pair]: [], ...styles };
        defaults[axis] = pair;
        note('info', `${axis}: в конфиге только стиль ${names[0]}, добавлен пустой ${pair} по умолчанию`);
    }
}

/** Defaults из `*Config` ядра (`<X>.tsx` / `<X>.ts`). Тема перекрывает ядро; ядро только добивает дыры. */
function readCoreDefaults(component: string, plasma: string): Record<string, string> {
    const dir = path.join(plasma, 'packages/plasma-new-hope/src/components', component);
    const file = ['tsx', 'ts'].map((e) => path.join(dir, `${component}.${e}`)).find((f) => fs.existsSync(f));
    if (!file) return {};
    return parseDefaultsBlock(fs.readFileSync(file, 'utf-8'));
}

/**
 * Собрать итоговые defaults: значения темы имеют приоритет, для вариаций без дефолта в теме
 * подставляется ядро — но только если такой стиль реально есть в конфиге темы.
 */
function mergeDefaults(
    theme: Record<string, string>,
    core: Record<string, string>,
    variations: Parsed['variations'],
): Record<string, string> {
    const out = { ...theme };
    for (const [axis, style] of Object.entries(core)) {
        if (out[axis]) continue;
        if (!variations[axis]) {
            note('info', `defaults ядра ссылается на вариация «${axis}», которой в конфиге темы нет: это вариация базового конфига ядра, в сиды не попадает`);
            continue;
        }
        if (!variations[axis][style]) {
            note(
                'decision',
                `defaults ядра: ${axis}='${style}', такого стиля нет в конфиге темы (${Object.keys(variations[axis]).join(', ')}), дефолт не выставлен`,
            );
            continue;
        }
        out[axis] = style;
        note('info', `${axis}: дефолт «${style}» взят из ядра (в конфиге темы не задан)`);
    }
    // Вариация без дефолта и в теме, и в `defaults` ядра (Pagination.type): превью показывает только
    // вариации с дефолтом, а ядро в таких случаях держит дефолт пропа `default`. Берём стиль `default`,
    // если он есть; иначе вариация остаётся без дефолта и уходит в отчёт.
    for (const axis of Object.keys(variations)) {
        if (out[axis]) continue;
        // `disabled` и `readOnly` не вариации, а состояния: их токены уходят в инварианты.
        if (STATE_AXES.has(axis)) continue;
        if (variations[axis].default) {
            out[axis] = 'default';
            note('info', `${axis}: дефолт «default» взят по имени стиля (ни тема, ни defaults ядра его не задают)`);
        } else {
            note('approx', `${axis}: дефолта нет ни в теме, ни в ядре, и стиля default нет; вариация не попадёт в панель превью, пока её не выбрать`);
        }
    }
    return out;
}

// ─── Value classification ────────────────────────────────────────────────────

const STATE_AXES = new Set(['disabled', 'readOnly']);
const NUM = /^(-?\d*\.?\d+)(rem|px)?$/;
const COLOR_LITERAL = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;
const toPx = (txt: string) => {
    const m = NUM.exec(txt)!;
    const n = parseFloat(m[1]);
    const px = Math.round((m[2] === 'rem' ? n * 16 : n) * 1000) / 1000;
    return px;
};
const fmt = (px: number) => String(px);

function colorTokenName(ident: string, aliases: Map<string, string>, base: Map<string, string>): string | null {
    if (aliases.has(ident)) return aliases.get(ident)!;
    let parts = ident.match(/[A-Z]?[a-z0-9]+/g)!.map((p) => p.toLowerCase());
    let sub = 'default';
    if (parts[0] === 'inverse') { sub = 'inverse'; parts = parts.slice(1); }
    else if (parts[0] === 'on' && (parts[1] === 'dark' || parts[1] === 'light')) { sub = `on-${parts[1]}`; parts = parts.slice(2); }
    const cat = parts[0];
    let rest = parts.slice(1);
    let suffix = '';
    if (rest.length && (rest[rest.length - 1] === 'hover' || rest[rest.length - 1] === 'active')) {
        suffix = `-${rest[rest.length - 1]}`;
        rest = rest.slice(0, -1);
    }
    const name = `${cat}.${sub}.${rest.join('-')}${suffix}`;
    return base.has(name) ? name : null;
}

/** CSS-переменная токена цвета в теме: `text.default.primary` → `var(--text-primary)`, как в ColorProp генератора. */
function colorCssVar(tokenName: string): string {
    const [category, subcategory, name] = tokenName.split('.');
    return `var(${[subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-')})`;
}

/**
 * Идентификаторы темы внутри составного значения (`color-mix(in srgb, ${textPrimary}, …)`)
 * заменяются на CSS-переменные: в сгенерированном конфиге импортов темы нет, и linaria
 * падает на неизвестной переменной. Неразрешённый идентификатор поднимается как решение.
 */
function inlineThemeIdents(raw: string, aliases: Map<string, string>, base: Map<string, string>, where: string): string {
    // `var(${accordionTokens.accordionItemPaddingVertical})` — ссылка на другой токен ядра того же
    // компонента: в пакете и превью это имя CSS-переменной, а не шаблонная подстановка.
    raw = raw.replace(/\$\{(?:tokens|\w+Tokens)\.(\w+)\}/g, (m, key) => {
        const cssVar = coreVarByKey.get(key);
        if (!cssVar) { note('decision', `${where}: ключ ядра ${key} внутри «${raw.slice(0, 40)}» не найден в tokens.ts`); return m; }
        return cssVar;
    });
    // `${bodyL.fontWeight}` — часть токена типографики: CSS-переменная темы пакета, как её
    // пишет TypographyProp генератора (`--plasma-typo-body-l-font-weight`, bold → `body-l-bold`).
    raw = raw.replace(/\$\{(\w+)\.(fontFamily|fontSize|fontStyle|fontWeight|letterSpacing|lineHeight)\}/g, (m, ident, part) => {
        const token = typoValue(ident, base);
        if (!token) { note('decision', `${where}: типографика ${ident} внутри «${raw.slice(0, 40)}» не найдена в базовой ДС`); return m; }
        const [family, size, weight] = token.split('.');
        const name = [family, size, weight === 'normal' ? '' : weight].filter(Boolean).join('-');
        return `var(--plasma-typo-${name}-${part.replace(/[A-Z]/g, (ch: string) => `-${ch.toLowerCase()}`)})`;
    });
    return raw.replace(/\$\{(\w+)\}/g, (m, ident) => {
        const token = colorTokenName(ident, aliases, base);
        if (!token) { note('decision', `${where}: идентификатор ${ident} внутри «${raw.slice(0, 40)}» не сопоставлен токену, задайте --alias=${ident}=<token>`); return m; }
        return colorCssVar(token);
    });
}

const TYPO_SUFFIX = ['FontFamily', 'FontSize', 'FontStyle', 'FontWeight', 'LetterSpacing', 'LineHeight'];
function typoGroup(key: string): { group: string; suffix: string } | null {
    for (const suf of TYPO_SUFFIX) {
        if (key.toLowerCase().endsWith(suf.toLowerCase())) {
            let prefix = key.slice(0, -suf.length);
            // `itemFontFamily` и `itemLetterSpacing` — одна группа; у Select `fontFamily` лежит
            // рядом с `fontLetterSpacing`, поэтому одиночный `font` тоже снимается.
            if (prefix.endsWith('Font')) prefix = prefix.slice(0, -4);
            else if (prefix === 'font') prefix = '';
            return { group: `${prefix || 'text'}Style`, suffix: suf };
        }
    }
    return null;
}

/** bodyL -> body.l.normal, bodyLBold -> body.l.bold, h6 -> header.h6.normal, dsplL -> display.l.normal */
function typoValue(ident: string, base: Map<string, string>): string | null {
    let family: string; let size: string; let weight = 'normal';
    const h = /^(h[1-6])(Bold|Medium)?$/.exec(ident);
    const m = /^(body|text|header|display|dspl)([A-Z][A-Za-z0-9]*?)(Bold|Medium)?$/.exec(ident);
    if (h) { family = 'header'; size = h[1]; if (h[2]) weight = h[2].toLowerCase(); }
    else if (m) { family = m[1] === 'dspl' ? 'display' : m[1]; size = m[2].toLowerCase(); if (m[3]) weight = m[3].toLowerCase(); }
    else return null;
    const name = `${family}.${size}.${weight}`;
    return base.get(name) === 'typography' ? name : null;
}

/** Идентификатор без суффикса веса: bodyLBold -> bodyL. */
const typoBase = (ident: string) => ident.replace(/(Bold|Medium)$/, '');

type PropType = 'color' | 'dimension' | 'float' | 'shadow' | 'shape' | 'typography' | 'value';
type Prop = { name: string; type: PropType; web: string[]; template: string | null; usedIn: string[] };
type Row = { variation: string; style: string; prop: string; token: string | null; value: string | null };

const INVARIANT_AXES = new Set(['disabled', 'readOnly']);

/** Ключи ядра, значение которых — радиус скругления: их сначала ищем среди токенов формы. */
const RADIUS_KEY = /(radius|rounding)$/i;
/** Радиус от этого значения (px) считается «капсулой» — токен `round.circle`. */
const CIRCLE_PX = 500;

type RadiusItem = { variation: string; style: string; px: number; raw: string };

function classify(
    parsed: Parsed,
    coreKeys: Set<string>,
    base: Map<string, string>,
    aliases: Map<string, string>,
    shapes: Map<string, number>,
) {
    const props = new Map<string, Prop>();
    const rows: Row[] = [];
    const typoParts = new Map<string, Map<string, string>>(); // `${var}|${style}|${group}` -> suffix -> ident
    const multi = new Map<string, Map<string, string>>(); // `${var}|${key}` -> style -> raw
    const numeric = new Map<string, Map<string, string>>(); // одиночные числа, тип решается после обхода
    const radii = new Map<string, RadiusItem[]>(); // key ядра -> значения по всем вариациям
    const unresolvedColors = new Set<string>();

    const addProp = (name: string, type: PropType, web: string[], variation: string) => {
        const p = props.get(name) ?? { name, type, web: [], template: null, usedIn: [] };
        if (p.type !== type) throw new Error(`Type conflict for ${name}: ${p.type} vs ${type}`);
        for (const w of web) if (!p.web.includes(w)) p.web.push(w);
        if (!p.usedIn.includes(variation)) p.usedIn.push(variation);
        props.set(name, p);
    };

    // Ключ, у которого рядом с числами встречается не выражаемое моделью значение
    // (`50%` у borderRadius в shape.circled, `100%` у размера), целиком уходит в `value`:
    // строки попадают в CSS как есть, но в панели не редактируются. Иначе одно свойство
    // получило бы два типа, а выкидывать значение нельзя — mergeConfig ядра подменяет стиль целиком.
    const isPlain = (raw: string) =>
        NUM.test(raw) || raw.split(/\s+/).every((t) => NUM.test(t) || t === 'auto');
    const isModelled = (raw: string) =>
        isPlain(raw) || raw === 'transparent' || raw === 'inherit' || COLOR_LITERAL.test(raw) || /^\$\{\w+(\.\w+)?\}$/.test(raw) || /^var\(--shadow-/.test(raw);
    const forceValue = new Set<string>();
    {
        const rawsByKey = new Map<string, string[]>();
        for (const variation of parsed.order)
            for (const items of Object.values(parsed.variations[variation]))
                for (const [key, raw] of items) rawsByKey.set(key, [...(rawsByKey.get(key) ?? []), raw]);
        for (const [key, raws] of rawsByKey) {
            if (raws.some(isModelled) && raws.some((r) => !isModelled(r))) {
                forceValue.add(key);
                note('approx', `${key}: рядом с числами есть «${raws.find((r) => !isModelled(r))}», всё свойство заведено как value (не редактируется в панели)`);
            }
        }
    }

    for (const variation of parsed.order) {
        for (const [style, items] of Object.entries(parsed.variations[variation])) {
            for (const [key, raw] of items) {
                if (!coreKeys.has(key)) {
                    note('skip', `${variation}.${style}.${key}: ключа нет в tokens ядра текущей версии, пропущен`);
                    continue;
                }
                if (forceValue.has(key)) {
                    addProp(key, 'value', [key], variation);
                    rows.push({ variation, style, prop: key, token: null, value: inlineThemeIdents(raw, aliases, base, `${variation}.${style}.${key}`) });
                    continue;
                }
                const tg = typoGroup(key);
                const mTypo = /^\$\{(\w+)\.(\w+)\}$/.exec(raw);
                if (tg && mTypo) {
                    const k = `${variation}|${style}|${tg.group}`;
                    if (!typoParts.has(k)) typoParts.set(k, new Map());
                    typoParts.get(k)!.set(tg.suffix, mTypo[1]);
                    addProp(tg.group, 'typography', [key], variation);
                    continue;
                }
                // Тень из sdds-themes: `shadowDownHardM` → токен `down.hard.m` базовой ДС.
                const mShadowIdent = /^\$\{shadow([A-Z][a-z]+)([A-Z][a-z]+)([A-Z][a-z]*)\}$/.exec(raw);
                if (mShadowIdent) {
                    const name = mShadowIdent.slice(1, 4).map((p) => p.toLowerCase()).join('.');
                    if (base.get(name) !== 'shadow') { note('decision', `${variation}.${style}.${key}: тень ${name} не найдена в базовой ДС`); continue; }
                    addProp(key, 'shadow', [key], variation);
                    rows.push({ variation, style, prop: key, token: null, value: name });
                    continue;
                }
                const mColor = /^\$\{(\w+)\}$/.exec(raw);
                if (mColor) {
                    const tokenName = colorTokenName(mColor[1], aliases, base);
                    if (!tokenName) { unresolvedColors.add(mColor[1]); continue; }
                    addProp(key, 'color', [key], variation);
                    rows.push({ variation, style, prop: key, token: tokenName, value: null });
                    continue;
                }
                // Литерал цвета (`#F3A912`, `rgba(...)`) — значение без токена, как `transparent`.
                if (raw === 'transparent' || raw === 'inherit' || COLOR_LITERAL.test(raw)) {
                    addProp(key, 'color', [key], variation);
                    rows.push({ variation, style, prop: key, token: null, value: raw });
                    continue;
                }
                const mShadow = /^var\(--shadow-([a-z]+)-([a-z]+)-([a-z]+)/.exec(raw);
                if (mShadow) {
                    const name = `${mShadow[1]}.${mShadow[2]}.${mShadow[3]}`;
                    if (base.get(name) !== 'shadow') { note('decision', `${variation}.${style}.${key}: тень ${name} не найдена в базовой ДС`); continue; }
                    addProp(key, 'shadow', [key], variation);
                    rows.push({ variation, style, prop: key, token: null, value: name });
                    continue;
                }
                if (NUM.test(raw)) {
                    // Радиус: и `0.25rem`, и безразмерный `0` — иначе `0` ушёл бы во float и конфликтовал.
                    if (RADIUS_KEY.test(key) && (/(rem|px)$/.test(raw) || raw === '0')) {
                        if (!radii.has(key)) radii.set(key, []);
                        radii.get(key)!.push({ variation, style, px: toPx(raw), raw });
                        continue;
                    }
                    // Тип решается по всем значениям ключа: `0` рядом с `0.25rem` — это dimension, а не float.
                    const k = `${variation}|${key}`;
                    if (!numeric.has(k)) numeric.set(k, new Map());
                    numeric.get(k)!.set(style, raw);
                    continue;
                }
                const toks = raw.split(/\s+/);
                if (toks.length > 1 && toks.every((t) => NUM.test(t) || t === 'auto')) {
                    const k = `${variation}|${key}`;
                    if (!multi.has(k)) multi.set(k, new Map());
                    multi.get(k)!.set(style, raw);
                    continue;
                }
                // Всё остальное (`auto`, `100%`, `fit-content`, `pointer`, transition, `url(...)`) —
                // свойство типа `value`: строка уходит в CSS как есть, в UI пока не редактируется.
                addProp(key, 'value', [key], variation);
                rows.push({ variation, style, prop: key, token: null, value: inlineThemeIdents(raw, aliases, base, `${variation}.${style}.${key}`) });
                note('info', `${variation}.${style}.${key}: «${raw.slice(0, 50)}» заведено как value, без токена`);
            }
        }
    }

    if (unresolvedColors.size) {
        throw new Error(
            `Не удалось сопоставить токены темы: ${[...unresolvedColors].join(', ')}.\n` +
                `Укажите соответствие явно: --alias=<ident>=<имя токена в базовой ДС>, например --alias=surfaceSolidCardBrightness=surface.default.solid-card-brightness`,
        );
    }

    // Одиночные числа: если хоть одно значение ключа с единицей, свойство — dimension (unitless как px),
    // иначе float. Тип должен совпасть у ключа во всех вариациях, иначе конфликт поднимет addProp.
    // Ключ, у которого в одних стилях одно число, а в других несколько (`padding: 0.375rem` у xs и
    // `0.5625rem 1rem 1rem 1rem` у xxs в Notification), одним шаблоном не выражается: подстановка
    // дала бы xs чужие боковые отступы. Такой ключ целиком уходит типом value — верно, но в панели
    // не редактируется.
    const shapeByKey = new Map<string, Set<number>>();
    for (const [k, byStyle] of [...numeric, ...multi]) {
        const key = k.split('|')[1];
        for (const raw of byStyle.values()) shapeByKey.set(key, new Set([...(shapeByKey.get(key) ?? []), raw.split(/\s+/).length]));
    }
    const mixedShape = new Set([...shapeByKey].filter(([, shapes]) => shapes.size > 1).map(([key]) => key));
    for (const source of [numeric, multi]) {
        for (const [k, byStyle] of source) {
            const [variation, key] = k.split('|');
            if (!mixedShape.has(key)) continue;
            addProp(key, 'value', [key], variation);
            for (const [style, raw] of byStyle) rows.push({ variation, style, prop: key, token: null, value: raw });
            source.delete(k);
        }
    }
    for (const key of mixedShape) note('approx', `${key}: разное число чисел по стилям, свойство заведено как value (в панели не редактируется)`);

    const unitByKey = new Map<string, boolean>();
    for (const [k, byStyle] of numeric) {
        const key = k.split('|')[1];
        if ([...byStyle.values()].some((v) => /(rem|px)$/.test(v))) unitByKey.set(key, true);
        else if (!unitByKey.has(key)) unitByKey.set(key, false);
    }
    for (const [k, byStyle] of numeric) {
        const [variation, key] = k.split('|');
        const isDim = unitByKey.get(key)!;
        addProp(key, isDim ? 'dimension' : 'float', [key], variation);
        for (const [style, raw] of byStyle) {
            rows.push({ variation, style, prop: key, token: null, value: isDim ? fmt(toPx(raw)) : raw });
        }
    }

    for (const [k, parts] of typoParts) {
        const [variation, style, group] = k.split('|');
        // Группа считается целой, если все шесть частей от одного токена; вес может отличаться
        // (`bodyL` + `bodyLBold.fontWeight`) — тогда берём токен с весом из FontWeight.
        const bases = new Set([...parts.values()].map(typoBase));
        // У Dropdown в ядре нет `itemFontWeight` (вес задаёт отдельный `itemFontWeightBold`):
        // группа из пяти частей от одного токена принимается с обычным весом.
        const missingOnlyWeight = parts.size === 5 && !parts.has('FontWeight');
        if (bases.size !== 1 || (parts.size !== 6 && !missingOnlyWeight)) {
            note('decision', `${variation}.${style}.${group}: шрифтовая группа неполная или смешанная (${[...parts.entries()].map(([s, i]) => `${s}=${i}`).join(', ')}), пропущена`);
            continue;
        }
        if (missingOnlyWeight) note('approx', `${variation}.${style}.${group}: в ядре нет ключа веса, группа собрана из пяти частей с обычным весом`);
        const weightIdent = parts.get('FontWeight') ?? parts.get('FontFamily')!;
        const value = typoValue(weightIdent, base);
        if (!value) { note('decision', `${variation}.${style}.${group}: типографика ${weightIdent} не найдена в базовой ДС, пропущена`); continue; }
        rows.push({ variation, style, prop: group, token: null, value });
    }

    // Радиусы: тип свойства решается по всему набору значений. `shape` требует токен темы для
    // каждого значения, поэтому одно непопавшее в `round.*` число уводит свойство в `dimension`.
    const shapeByPx = new Map([...shapes].map(([name, px]) => [px, name] as const));
    // Радиус-«капсула» в конфигах пишут произвольно большим (`1000px`, `9999px`): любой радиус
    // от CIRCLE_PX и выше — это токен `round.circle`, а не число.
    const circleToken = shapes.has('round.circle') ? 'round.circle' : null;
    const shapeTokenFor = (px: number) => (px >= CIRCLE_PX && circleToken) || shapeByPx.get(px) || null;
    for (const [key, items] of radii) {
        const matched = items.map((it) => ({ ...it, token: shapeTokenFor(it.px) }));
        const unmatched = matched.filter((m) => !m.token);
        const asShape = unmatched.length === 0;
        for (const m of matched) {
            addProp(key, asShape ? 'shape' : 'dimension', [key], m.variation);
            rows.push({
                variation: m.variation,
                style: m.style,
                prop: key,
                token: asShape ? m.token : null,
                value: asShape ? null : fmt(m.px),
            });
        }
        if (asShape) {
            const used = [...new Set(matched.map((m) => m.token!))].join(', ');
            note('info', `${key}: значения совпали с токенами формы (${used}), свойство заведено как shape`);
        } else {
            const lost = [...new Set(unmatched.map((m) => m.raw))].join(', ');
            note('approx', `${key}: ${lost} не совпадают ни с одним round.*, всё свойство заведено как dimension`);
        }
    }

    const expand = (t: string[]) =>
        t.length === 1 ? [t[0], t[0], t[0], t[0]] : t.length === 2 ? [t[0], t[1], t[0], t[1]] : t.length === 3 ? [t[0], t[1], t[2], t[1]] : t;

    for (const [k, byStyle] of multi) {
        const [variation, key] = k.split('|');
        const styles = [...byStyle.keys()];
        let tokLists = new Map(styles.map((s) => [s, byStyle.get(s)!.split(/\s+/)]));
        if (new Set([...tokLists.values()].map((t) => t.length)).size > 1) {
            tokLists = new Map([...tokLists].map(([s, t]) => [s, expand(t)]));
        }
        const n = tokLists.get(styles[0])!.length;
        let skeletonOk = [...tokLists.values()].every((t) => t.length === n);
        if (skeletonOk) {
            for (let i = 0; i < n; i++) {
                const kinds = new Set(styles.map((s) => (NUM.test(tokLists.get(s)![i]) ? 'num' : tokLists.get(s)![i])));
                if (kinds.size !== 1) { skeletonOk = false; break; }
            }
        }
        if (!skeletonOk) { note('decision', `${variation}.${key}: разная форма значения по стилям (${styles.map((s) => `${s}: ${byStyle.get(s)}`).join('; ')}), пропущено`); continue; }

        const numPos = [...Array(n).keys()].filter((i) => NUM.test(tokLists.get(styles[0])![i]));
        const col = new Map(numPos.map((i) => [i, styles.map((s) => toPx(tokLists.get(s)![i]))]));
        const varying = numPos.filter((i) => new Set(col.get(i)).size > 1);
        const anchor = parsed.defaults[variation] && styles.includes(parsed.defaults[variation]) ? parsed.defaults[variation] : styles[0];
        let P: number[];
        let exact: boolean;
        if (varying.length === 0) {
            const first = tokLists.get(styles[0])!;
            const nz = numPos.filter((i) => toPx(first[i]) !== 0);
            P = [nz.length ? nz[0] : numPos[0]];
            exact = true;
        } else {
            const range = new Map(varying.map((i) => [i, Math.max(...col.get(i)!) - Math.min(...col.get(i)!)]));
            const lead = varying.reduce((a, b) => (range.get(b)! > range.get(a)! ? b : a));
            P = varying.filter((i) => col.get(i)!.every((v, idx) => v === col.get(lead)![idx]));
            exact = P.length === varying.length;
        }
        const template = tokLists.get(anchor)!.map((t, i) => (P.includes(i) ? '$1' : t)).join(' ');
        if (!exact) {
            const lost = styles.filter((s) => s !== anchor).map((s) => `${s}: ${byStyle.get(s)}`).join('; ');
            note('approx', `${variation}.${key}: шаблон «${template}», точен для «${anchor}»; в остальных размерах второе число взято из него (${lost})`);
        }
        addProp(key, 'dimension', [key], variation);
        props.get(key)!.template = template;
        for (const s of styles) rows.push({ variation, style: s, prop: key, token: null, value: fmt(toPx(tokLists.get(s)![P[0]])) });
    }

    // Типографика, радиусы и шаблоны разбирались после основного прохода, поэтому строки
    // возвращаются к порядку вариаций и стилей конфига: по нему группируются комментарии в сиде.
    const styleIdx = (r: Row) => Object.keys(parsed.variations[r.variation] ?? {}).indexOf(r.style);
    rows.sort((a, b) => parsed.order.indexOf(a.variation) - parsed.order.indexOf(b.variation) || styleIdx(a) - styleIdx(b));

    // Вариации disabled/readOnly: значения уходят в инварианты, вариация не заводится.
    const invariantRows: Row[] = [];
    const variationRows: Row[] = [];
    for (const r of rows) (INVARIANT_AXES.has(r.variation) ? invariantRows : variationRows).push(r);
    for (const p of props.values()) p.usedIn = p.usedIn.filter((v) => !INVARIANT_AXES.has(v));
    const order = parsed.order.filter((v) => !INVARIANT_AXES.has(v));
    for (const v of parsed.order.filter((v) => INVARIANT_AXES.has(v))) {
        note('info', `вариация «${v}» не заводится как вариация: её ${Object.values(parsed.variations[v]).flat().length} токенов ушли в инварианты`);
    }
    const firstByProp = new Map<string, Row>();
    const dedupInvariants: Row[] = [];
    for (const r of invariantRows) {
        const first = firstByProp.get(r.prop);
        if (!first) { firstByProp.set(r.prop, r); dedupInvariants.push(r); continue; }
        const same = first.token === r.token && first.value === r.value;
        note(same ? 'info' : 'decision',
            `${r.prop}: задан и в «${first.variation}», и в «${r.variation}»${same ? ' с одним значением, оставлено одно' : ` с разными значениями (${first.token ?? first.value} / ${r.token ?? r.value}), оставлено из «${first.variation}»`}`);
    }
    for (const axis of Object.keys(parsed.defaults)) {
        if (!parsed.variations[axis]) note('info', `defaults ссылается на вариация «${axis}», которой в конфиге нет: это вариация базового конфига ядра, в сиды не попадает`);
    }

    return { props, variationRows, invariantRows: dedupInvariants, order };
}

// ─── Seed emission ───────────────────────────────────────────────────────────

const VAR_DESC: Record<string, string> = {
    view: 'Вид', size: 'Размер', shape: 'Форма', labelPlacement: 'Расположение лейбла', chipView: 'Вид чипа',
    hintView: 'Вид подсказки', hintSize: 'Размер подсказки', orientation: 'Ориентация', stretching: 'Растяжение',
};

/** Дополнения для составного компонента (несколько appearance, дочерние элементы). */
type Extras = {
    /** Дочерние компоненты (compose), только у родителя. */
    children: string[];
    /** Имена экспортов ядра, если не выводятся из имени компонента. */
    coreExports?: CoreExports;
    /** Проп, по которому обёртка пакета выбирает appearance (`orientation`), и appearance по умолчанию. */
    appearanceProp?: { prop: string; default: string };
};

/** Один appearance компонента: разобранный конфиг темы и его значения. */
type AppearanceInput = { name: string; parsed: Parsed; data: ReturnType<typeof classify> };

type CoreExports = { tokens?: string; config?: string };

/**
 * Имена экспортов ядра для компонента: объект токенов и базовый конфиг, если они названы
 * не `<component>Tokens` / `<component>Config`. Читаются из `index.ts` папки компонента ядра
 * (`export { tokens as tabsTokens }`, `export { lineSkeletonRoot, lineSkeletonConfig }`).
 */
function detectCoreExports(args: Args, component: string, coreDirName = component): CoreExports {
    const lower = component.charAt(0).toLowerCase() + component.slice(1);
    const indexFile = path.join(args.plasma, 'packages/plasma-new-hope/src/components', coreDirName, 'index.ts');
    if (!fs.existsSync(indexFile)) return {};
    const src = fs.readFileSync(indexFile, 'utf-8');
    const out: CoreExports = {};
    // `export { tokens as segmentTokens, classes as segmentClasses }` — токены могут идти не одни.
    const tokensMatch = /export \{[^}]*\btokens as (\w+)/.exec(src);
    if (tokensMatch && tokensMatch[1] !== `${lower}Tokens`) out.tokens = tokensMatch[1];
    const configs = [...src.matchAll(/\b(\w+Config)\b/g)].map((m) => m[1]).filter((n) => n !== 'config');
    if (configs.length && !configs.includes(`${lower}Config`) && new Set(configs).size === 1) out.config = configs[0];
    return out;
}

function emitSeeds(
    args: Args,
    appearances: AppearanceInput[],
    /** Свойства компонента, общие для всех appearance. */
    props: Map<string, Prop>,
    dbDir: string,
    extras?: Extras,
    /** Пустой компонент: только строка компонента, связь с ДС и appearance, без вариаций и свойств. */
    empty = false,
) {
    const COMP = args.component;
    const seedsDir = path.join(dbDir, 'seeds', 'prod');
    const componentDir = path.join(seedsDir, 'components', componentDirName(COMP));
    const patcher = new SeedPatcher(!args.apply);

    if (fs.existsSync(componentDir)) {
        if (args.apply) throw new Error(`Компонент ${COMP} уже есть в сидах. Снимите его (--remove --apply) перед повторным импортом.`);
        console.log(`  (${COMP} уже есть в сидах; при --apply импорт будет остановлен)`);
        return;
    }

    const coreExports = extras?.coreExports ?? detectCoreExports(args, COMP, sddsDirName(args, COMP));
    const description = readWrapperDescription(args, COMP);
    const wrapperShape = readWrapperShape(args, COMP);
    const reexports = readIndexReexports(args, COMP, dbDir);
    writeComponentManifest(patcher, dbDir, COMP, {
        ...(coreExports.tokens ? { coreTokensExport: coreExports.tokens } : {}),
        ...(coreExports.config ? { coreConfigExport: coreExports.config } : {}),
        ...wrapperShape,
        ...(reexports ? { reexports } : {}),
        ...(extras?.appearanceProp ? { appearances: extras.appearanceProp } : {}),
    });

    // Шаблон многозначного токена — поправка web-параметра: число стиля подставляется в `$1`.
    const templateAdjust = (prop: string): Pick<ValueSeed, 'adjust'> => {
        const p = props.get(prop);
        return p?.template ? { adjust: [{ platform: 'web', param: p.web[0], template: p.template }] } : {};
    };
    const toValue = (r: Row): ValueSeed => ({
        prop: r.prop,
        ...(r.token ? { token: r.token } : {}),
        ...(r.value !== null ? { value: r.value } : {}),
        ...templateAdjust(r.prop),
    });

    // Вариации и стили общие: порядок — по первому появлению в appearance.
    // `data.order` — вариации после разбора: `disabled`/`readOnly` из него уже ушли в инварианты.
    const order: string[] = [];
    const stylesOf: Record<string, string[]> = {};
    for (const { parsed, data } of appearances) {
        for (const v of data.order) {
            if (!order.includes(v)) order.push(v);
            stylesOf[v] ??= [];
            for (const style of Object.keys(parsed.variations[v])) if (!stylesOf[v].includes(style)) stylesOf[v].push(style);
        }
    }

    const appearanceSeeds: AppearanceSeed[] = appearances.map(({ name, parsed, data }) => {
        const values: ValuesSeed = {};
        for (const v of data.order) values[v] = Object.fromEntries(Object.keys(parsed.variations[v]).map((style) => [style, []]));
        for (const r of data.variationRows) values[r.variation][r.style].push(toValue(r));
        const sameAsAll = data.order.join(',') === order.join(',');
        const defaults = Object.fromEntries(Object.entries(parsed.defaults).filter(([v]) => data.order.includes(v)));
        return {
            name,
            ...(sameAsAll ? {} : { variations: data.order }),
            ...(Object.keys(defaults).length ? { defaults } : {}),
            values,
            ...(data.invariantRows.length ? { invariants: data.invariantRows.map((r) => toValue(r)) } : {}),
        };
    });

    const seed: ComponentSeed = {
        name: COMP,
        ...(description ? { description } : {}),
        properties: empty
            ? []
            : [...props.values()].map((p) => ({
                  name: p.name,
                  type: p.type,
                  ...(p.usedIn.length ? { variations: p.usedIn } : {}),
                  params: { web: p.web },
              })),
        variations: empty
            ? []
            : order.map((v) => ({
                  name: v,
                  description: VAR_DESC[v] ?? v,
                  styles: stylesOf[v].map((style) => ({ name: style, description: style })),
              })),
        appearances: empty ? [{ name: 'default', values: {} }] : appearanceSeeds,
    };

    const rel = path.relative(dbDir, componentDir);
    if (args.apply) {
        writeComponentSeed(componentDir, seed);
        console.log(`  Written: ${rel}/ (index, properties, variations, values)`);
    } else {
        console.log(`  Would write: ${rel}/ (index, properties, variations, values)`);
    }

    if (extras?.children.length) {
        patcher.patchFile(path.join(seedsDir, 'component_deps.ts'), (c) => {
            const lines = extras.children
                .map((child, i) => `    { parent: ${esc(COMP)}, child: ${esc(child)}, type: 'compose', order: ${i + 1} },`)
                .filter((line) => !c.includes(line));
            if (!lines.length) return c;
            return insertBeforeRegex(c, /\n\];\n\nexport async function seedComponentDeps/, `\n${lines.join('\n')}`, 'component_deps rows');
        });
    }
}

// ─── Removal ─────────────────────────────────────────────────────────────────

/**
 * Снять компонент из сидов — удалить его папку. Остальное от компонента не зависит:
 * реестра нет, а связи в `component_deps.ts` заданы именами и пропускаются, пока компонента нет,
 * поэтому они остаются и после повторного импорта продолжают работать.
 */
function removeSeeds(args: Args, dbDir: string) {
    const COMP = args.component;
    const seedsDir = path.join(dbDir, 'seeds', 'prod');
    const componentDir = path.join(seedsDir, 'components', componentDirName(COMP));
    const rel = path.relative(dbDir, componentDir);

    if (!fs.existsSync(componentDir)) {
        console.log(`  ${COMP} в сидах не найден (нет папки ${rel}); удалять нечего.`);
        return;
    }
    if (args.apply) fs.rmSync(componentDir, { recursive: true, force: true });
    console.log(`  ${args.apply ? 'Removed' : 'Would remove'}: ${rel}/`);

    const deps = fs.readFileSync(path.join(seedsDir, 'component_deps.ts'), 'utf-8');
    const related = [...deps.matchAll(/\{ parent: '(\w+)', child: '(\w+)', type: '(\w+)'/g)]
        .filter((m) => m[1] === COMP || m[2] === COMP)
        .map((m) => `${m[1]} → ${m[2]} (${m[3]})`);
    if (related.length) console.log(`  связи в component_deps.ts оставлены: ${related.join(', ')}`);
}

// ─── Story hints ─────────────────────────────────────────────────────────────

function storyHints(args: Args) {
    const sb = path.join(args.plasma, 'utils/plasma-sb-utils/src/components', args.component, 'meta.ts');
    const example = path.join(args.plasma, 'packages/plasma-new-hope/src/examples/components', args.component, `${args.component}.stories.tsx`);
    const out: string[] = [];
    if (fs.existsSync(sb)) {
        const src = fs.readFileSync(sb, 'utf-8');
        const m = /args:\s*\{([\s\S]*?)\n\s*\.\.\.defaultArgs/.exec(src) ?? /args:\s*\{([\s\S]*?)\n\s{8}\},/.exec(src);
        out.push(`storybook args (${path.relative(args.plasma, sb)}):`);
        if (m) out.push(m[1].split('\n').map((l) => l.trim()).filter(Boolean).join(' '));
    } else if (fs.existsSync(example)) {
        out.push(`storybook: ${path.relative(args.plasma, example)} (в plasma-sb-utils компонента нет)`);
    } else {
        out.push('storybook: источник аргументов не найден');
    }
    return out.join('\n  ');
}

// ─── Main ────────────────────────────────────────────────────────────────────

// ─── sdds-serv wrapper, manifest, index reexports ────────────────────────────

/** Папка компонента в sdds-serv: по умолчанию имя компонента, для подкомпонентов — `--dir-name`. */
const sddsDirName = (args: Args, component: string) => args.dirName ?? component;
const sddsWrapperFile = (args: Args, component: string) => {
    const dirName = sddsDirName(args, component);
    const dir = path.join(args.plasma, 'packages/sdds-serv/src/components', dirName);
    return ['tsx', 'ts'].map((e) => path.join(dir, `${dirName}.${e}`)).find((f) => fs.existsSync(f));
};

/**
 * Описание компонента: JSDoc над `export const <X>` в обёртке sdds-serv (`<X>.tsx`),
 * например «Группа кнопок.». Без обёртки или без JSDoc — пустая строка.
 */
function readWrapperDescription(args: Args, component: string): string {
    const file = sddsWrapperFile(args, component);
    if (!file) return '';
    const src = fs.readFileSync(file, 'utf8');
    // Только JSDoc, стоящий прямо перед экспортом: ленивое `[\s\S]*?` от первого `/**` в файле
    // склеивало все комментарии обёртки в одно описание.
    const m = src.match(new RegExp(`\\/\\*\\*((?:(?!\\*\\/)[\\s\\S])*)\\*\\/\\s*export const ${component}\\b`));
    if (!m) return '';
    return m[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ');
}

/**
 * Форма обёртки из `<X>.tsx` sdds-serv: приведение `as ForwardRefExoticComponent<XProps & …>`
 * даёт `castToProps`. Пустой объект — базовый шаблон, в сиды не пишется.
 */
function readWrapperShape(args: Args, component: string): Pick<Manifest, 'castToProps' | 'generic' | 'siblings' | 'appearances'> {
    const file = sddsWrapperFile(args, component);
    if (!file) return {};
    const src = fs.readFileSync(file, 'utf8');
    // Обёртка через `createConditionalComponent` (Range): appearance выбирается пропом `appearance`,
    // конфиг ядра один. Генератор соберёт такую же обёртку из тех appearance, что есть в ДС.
    if (src.includes('createConditionalComponent(')) return { appearances: { conditional: true } };
    // Соседи в той же обёртке без конфига темы (`ToolbarDivider = component(mergeConfig(toolbarDividerConfig))`,
    // DrawerContent/Header/Footer): генератор пишет им пустые обёртки рядом с компонентом.
    const mergedOf = new Map<string, string>();
    for (const m of src.matchAll(/const (\w+) = mergeConfig\((\w+)\);/g)) mergedOf.set(m[1], m[2]);
    const siblings = [...src.matchAll(/export const (\w+) = component\((\w+)\);/g)]
        .filter((m) => m[1] !== component && mergedOf.has(m[2]))
        .map((m) => ({ name: m[1], coreConfigExport: mergedOf.get(m[2])! }));
    const siblingsPart = siblings.length ? { siblings } : {};
    const cast = new RegExp(`${component}\\b[^\\n]*as ForwardRefExoticComponent<\\s*(\\w+)\\s*&`).exec(src) ?? /as ForwardRefExoticComponent<\s*(\w+)\s*&/.exec(src);
    if (cast) return { ...siblingsPart, castToProps: cast[1] };
    // Дженерик (Select, Combobox, Dropdown): `fixedForwardRef` сохраняет параметр типа элемента.
    // Тип пропсов и тип элемента берутся из `import type { … } from '@salutejs/plasma-new-hope'`,
    // тип ref — из сигнатуры функции-обёртки.
    if (src.includes('fixedForwardRef(')) {
        const coreImport = /import type \{([^}]*)\} from '@salutejs\/plasma-new-hope';/.exec(src)?.[1] ?? '';
        const names = coreImport.split(',').map((n) => n.trim()).filter(Boolean);
        const propsType = names.map((n) => n.split(/\s+as\s+/)[0]).find((n) => /Props$/.test(n));
        const itemType = /<\w+ extends (\w+)>\s*\(\s*\n?\s*props/.exec(src)?.[1];
        const refElement = /ForwardedRef<(\w+)>/.exec(src)?.[1];
        if (propsType && itemType && refElement) return { ...siblingsPart, generic: { propsType, itemType, refElement } };
        note('decision', `обёртка дженерик, но не разобрана: propsType=${propsType}, itemType=${itemType}, refElement=${refElement}; задай generic в манифесте руками`);
    }
    return siblingsPart;
}

type Manifest = {
    coreTokensExport?: string;
    coreConfigExport?: string;
    castToProps?: string;
    reexports?: { runtime?: string[]; types?: string[]; localTypes?: string[]; coreTypes?: string[]; local?: string[] };
    generic?: { propsType: string; itemType: string; refElement: string };
    siblings?: { name: string; coreConfigExport: string }[];
    /**
     * Несколько appearance: `{ prop, default }` (Tabs, свой конфиг ядра на appearance) или
     * `{ conditional: true }` (Range, один конфиг ядра и `createConditionalComponent` по пропу `appearance`).
     */
    appearances?: { prop: string; default: string } | { conditional: true };
};

function writeComponentManifest(patcher: SeedPatcher, dbDir: string, component: string, manifest: Manifest) {
    const dir = path.resolve(dbDir, '../../../generator/app/templates', component);
    const file = path.join(dir, 'component.json');
    // Сливаем с существующим: у дочерних составного (TabItem) имя токенов задаёт импорт
    // родителя, а реэкспорты и cast приходят из своего index.ts; ни один прогон не знает всё.
    const existing: Manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const merged: Manifest = { ...existing, ...manifest };
    const re = merged.reexports;
    if (!re?.runtime?.length && !re?.types?.length && !re?.localTypes?.length && !re?.coreTypes?.length && !re?.local?.length) delete merged.reexports;
    if (!Object.keys(merged).length) {
        if (fs.existsSync(file)) patcher.deleteFile(file);
        return;
    }
    if (JSON.stringify(merged) === JSON.stringify(existing)) return;
    console.log(`  манифест генератора: ${JSON.stringify(merged)}`);
    patcher.writeFile(file, `${JSON.stringify(merged, null, 4)}\n`);
}

const CORE_SC = '@salutejs/plasma-new-hope/styled-components';

/**
 * Реэкспорты из `index.ts` sdds-serv. Берутся только имена из ядра
 * (`@salutejs/plasma-new-hope/styled-components`): напрямую или через обёртку
 * (`export { Card, CardContent } from './Card'` — CardContent тоже из ядра). Экспорты из других
 * локальных файлов (`./TabItem`, `./TabsController`) и других пакетов не переносятся: первые
 * даёт генератор сам, вторые поднимаются в отчёт.
 */
function readIndexReexports(args: Args, component: string, dbDir?: string): Manifest['reexports'] {
    const dirName = sddsDirName(args, component);
    // Если у генератора есть шаблон обёртки `templates/<X>/<X>.tsx` (Toast, Notification), локальные
    // экспорты обёртки (ToastProvider, NotificationsProvider) отдаёт он: index.ts экспортирует их из './<X>'.
    const templateDir = dbDir ? path.resolve(dbDir, '../../../generator/app/templates', component) : null;
    const hasWrapperTemplate = Boolean(templateDir && ['tsx', 'ts'].some((e) => fs.existsSync(path.join(templateDir, `${component}.${e}`))));
    const dir = path.join(args.plasma, 'packages/sdds-serv/src/components', dirName);
    const file = ['ts', 'tsx'].map((e) => path.join(dir, `index.${e}`)).find((f) => fs.existsSync(f));
    if (!file) return undefined;
    const src = fs.readFileSync(file, 'utf8');
    // Имена, которые обёртка объявляет сама (`export const ToolbarDivider = …`, `SegmentItem`,
    // `NotificationsProvider`): это не реэкспорт ядра. Соседи из `siblings` генератор пишет сам,
    // остальные требуют шаблона или отдельного компонента.
    const wrapperFile = sddsWrapperFile(args, component);
    const wrapperSrc = wrapperFile ? fs.readFileSync(wrapperFile, 'utf8') : '';
    const localNames = new Set([...wrapperSrc.matchAll(/export const (\w+)\b/g)].map((m) => m[1]));
    const siblingNames = new Set((readWrapperShape(args, component).siblings ?? []).map((s) => s.name));
    const runtime: string[] = [];
    const types: string[] = [];
    const localTypes: string[] = [];
    const coreTypes: string[] = [];
    const local: string[] = [];
    // `export type { Props as ComboboxProps } from './Combobox'` — наружу уходит имя после `as`.
    const exported = (n: string) => n.split(/\s+as\s+/).pop()!.trim();
    for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
        const isType = Boolean(m[1]);
        const names = m[2].split(',').map((n) => exported(n)).filter(Boolean);
        const from = m[3];
        if (from === '@salutejs/plasma-new-hope' && isType) {
            coreTypes.push(...names);
        } else if (from === CORE_SC) {
            (isType ? types : runtime).push(...names);
        } else if (from === `./${dirName}`) {
            const extra = names.filter((n) => n !== component);
            if (!isType) {
                for (const n of extra) {
                    if (siblingNames.has(n)) continue;
                    if (!localNames.has(n)) runtime.push(n);
                    else if (hasWrapperTemplate) local.push(n);
                    else note('decision', `index.ts: ${n} объявлен в обёртке sdds-serv, генератор его не даёт — нужен шаблон templates/${component}/${component}.tsx или отдельный компонент`);
                }
                continue;
            }
            // Обёртка sdds-serv объявляет `XProps = ComponentProps<typeof X>`; генератор умеет
            // только этот тип, остальные локальные типы поднимаются в отчёт.
            for (const n of extra) {
                if (n === `${component}Props`) localTypes.push(n);
                else note('skip', `index.ts: локальный тип ${n} из обёртки генератор не пишет`);
            }
        } else if (from.startsWith('./')) {
            // дочерние составного и шаблоны (`./TabItem`, `./TabsController`) генератор экспортирует сам
        } else {
            note('decision', `index.ts: экспорт ${names.join(', ')} из «${from}» не перенесён, в манифесте только ${CORE_SC}`);
        }
    }
    const uniq = (list: string[]) => [...new Set(list)];
    return {
        ...(runtime.length ? { runtime: uniq(runtime) } : {}),
        ...(types.length ? { types: uniq(types) } : {}),
        ...(localTypes.length ? { localTypes: uniq(localTypes) } : {}),
        ...(coreTypes.length ? { coreTypes: uniq(coreTypes) } : {}),
        ...(local.length ? { local: uniq(local) } : {}),
    };
}

// ─── Composite components (several appearances) ─────────────────────────────

/** Найти файл `<name>.tsx` в папке компонента ядра (конфиги ядра Tabs лежат в ui/<appearance>/<Name>/). */
function findCoreFile(dir: string, name: string): string | null {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { const f = findCoreFile(full, name); if (f) return f; }
        else if (entry.name === `${name}.tsx` || entry.name === `${name}.ts`) return full;
    }
    return null;
}

function runComposite(args: Args, dbDir: string) {
    const seedsDir = path.join(dbDir, 'seeds', 'prod');
    const parent = args.component;
    const dir = args.dir!;
    if (!args.tokens || !fs.existsSync(args.tokens)) {
        console.error('Для составного компонента укажите --tokens=<файл tokens.ts ядра>.');
        process.exit(1);
    }
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

    // element -> appearance -> config file
    const byElement = new Map<string, Map<string, string>>();
    const appearanceNames: string[] = [];
    for (const sub of fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
        const files = fs.readdirSync(path.join(dir, sub)).filter((f) => /\.config\.tsx?$/.test(f)).sort();
        if (!files.length) continue;
        appearanceNames.push(sub);
        for (const f of files) {
            const stem = f.replace(/\.config\.tsx?$/, '');
            const element = stem.startsWith(cap(sub)) ? stem.slice(cap(sub).length) : stem;
            if (!byElement.has(element)) byElement.set(element, new Map());
            byElement.get(element)!.set(sub, path.join(dir, sub, f));
        }
    }
    if (!byElement.has(parent)) {
        console.error(`В ${dir} нет конфига элемента ${parent} (ожидался <Appearance>${parent}.config.ts). Найдены: ${[...byElement.keys()].join(', ')}`);
        process.exit(1);
    }
    const elements = [parent, ...[...byElement.keys()].filter((e) => e !== parent).sort()];
    // Appearance по умолчанию — первый по алфавиту: у Tabs это horizontal, как в обёртке sdds-serv.
    const appearanceProp = { prop: args.root, default: appearanceNames[0] };
    console.log(`Составной компонент ${parent}: appearance по пропу «${args.root}» = ${appearanceNames.join(', ')}; элементы: ${elements.join(', ')}\n`);

    coreVarByKey = readCoreTokens(args.tokens);
    const coreKeys = new Set(coreVarByKey.keys());
    const base = readBaseThemeTokens(seedsDir);
    const shapes = readShapeTokenPx(seedsDir);
    const coreDir = path.join(args.plasma, 'packages/plasma-new-hope/src/components', parent);

    for (const element of elements) {
        const configs = byElement.get(element)!;
        report.length = 0;
        const props = new Map<string, Prop>();
        const appearances: AppearanceInput[] = [];
        const missing: string[] = [];

        for (const name of appearanceNames) {
            const file = configs.get(name);
            if (!file) { missing.push(name); continue; }
            const parsed = parseConfig(file);
            const coreFile = findCoreFile(coreDir, `${cap(name)}${element}`);
            const coreDefaults = coreFile ? parseDefaultsBlock(fs.readFileSync(coreFile, 'utf-8')) : {};
            parsed.defaults = mergeDefaults(parsed.defaults, coreDefaults, parsed.variations);
            const data = classify(parsed, coreKeys, base, args.aliases, shapes);

            for (const p of data.props.values()) {
                const existing = props.get(p.name);
                if (!existing) { props.set(p.name, { ...p, web: [...p.web], usedIn: [...p.usedIn] }); continue; }
                if (existing.type !== p.type) throw new Error(`${element}: тип ${p.name} различается между appearance (${existing.type} / ${p.type})`);
                for (const w of p.web) if (!existing.web.includes(w)) existing.web.push(w);
                for (const v of p.usedIn) if (!existing.usedIn.includes(v)) existing.usedIn.push(v);
                if (p.template && !existing.template) existing.template = p.template;
                else if (p.template && existing.template && p.template !== existing.template) note('approx', `${p.name}: шаблон в «${name}» (${p.template}) отличается от принятого (${existing.template}); шаблон один на свойство`);
            }
            appearances.push({ name, parsed, data });
        }
        if (missing.length) note('info', `${element}: нет конфига под ${missing.join(', ')}; эти appearance у элемента не заводятся`);

        const detected = detectCoreExports(args, element, parent);
        const extras: Extras = {
            children: element === parent ? elements.filter((e) => e !== parent) : [],
            // Базовый конфиг ядра выбирается по appearance (`horizontalTabsConfig`); нужен только объект токенов.
            coreExports: { tokens: detected.tokens },
            appearanceProp,
        };

        console.log(`═══ ${element}${element === parent ? ' (родитель)' : ' (дочерний, compose)'}`);
        for (const a of appearances) {
            console.log(`  ${a.name}: ${a.data.order.map((v) => `${v}[${Object.keys(a.parsed.variations[v]).join(',')}]`).join(' ')}; defaults ${JSON.stringify(a.parsed.defaults)}`);
        }
        console.log(`  свойств ${props.size}, значений ${appearances.reduce((n, a) => n + a.data.variationRows.length, 0)}, инвариантов ${appearances.reduce((n, a) => n + a.data.invariantRows.length, 0)}, шаблонов ${[...props.values()].filter((p) => p.template).length}`);
        const print = (kind: ReportEntry['kind'], title: string) => {
            const items = report.filter((r) => r.kind === kind);
            if (!items.length) return;
            console.log(`  ${title} (${items.length}):`);
            for (const r of items) console.log(`    - ${r.text}`);
        };
        print('decision', 'ТРЕБУЕТ РЕШЕНИЯ'); print('approx', 'ПРИБЛИЖЕНИЯ'); print('skip', 'ПРОПУЩЕНО'); print('info', 'СПРАВКА');
        console.log(args.apply ? '  Patching seed files...' : '  Dry run.');
        emitSeeds({ ...args, component: element }, appearances, props, dbDir, extras);
        console.log();
    }
    console.log(`  ${storyHints(args)}\n`);
    if (args.apply) console.log(`Дальше: docker exec db-service-dev npm run db:seed:prod -- --component=${parent}, затем по каждому дочернему.`);
}

function main() {
    const args = parseArgs();
    const dbDir = __dirname;
    const seedsDir = path.join(dbDir, 'seeds', 'prod');
    const X = args.component;

    if (args.manifest) {
        console.log(`Манифест генератора для ${X}${args.apply ? '' : ' (dry run, add --apply)'}`);
        const patcher = new SeedPatcher(!args.apply);
        const coreExports = detectCoreExports(args, X, sddsDirName(args, X));
        const reexports = readIndexReexports(args, X, dbDir);
        writeComponentManifest(patcher, dbDir, X, {
            ...(coreExports.tokens ? { coreTokensExport: coreExports.tokens } : {}),
            ...(coreExports.config ? { coreConfigExport: coreExports.config } : {}),
            ...readWrapperShape(args, X),
            ...(reexports ? { reexports } : {}),
        });
        for (const r of report) console.log(`  - ${r.text}`);
        return;
    }

    if (args.remove) {
        console.log(`Удаление ${X} из сидов${args.apply ? '' : ' (dry run, add --apply)'}...`);
        removeSeeds(args, dbDir);
        if (args.apply) console.log(`\nДальше: повторный импорт с --apply, затем docker exec db-service-dev npm run db:seed:prod -- --component=${X}`);
        return;
    }

    if (args.dir) {
        runComposite(args, dbDir);
        return;
    }

    const tokensFile = args.tokens ?? path.join(args.plasma, 'packages/plasma-new-hope/src/components', X, `${X}.tokens.ts`);
    const cfgDir = path.join(args.plasma, 'packages/sdds-serv/src/components', X);
    const configFile = args.config ?? ['ts', 'tsx'].map((e) => path.join(cfgDir, `${X}.config.${e}`)).find((f) => fs.existsSync(f));

    // Пустой компонент: обёртка в sdds-serv есть, а конфига темы нет (Image, AvatarGroup) или он
    // без единого стиля (Price: `view: {}`). В ДС нечего хранить, но из пакета компонент должен
    // экспортироваться, поэтому заводятся только строка компонента, связь с ДС и appearance.
    const wrapperFile = ['tsx', 'ts'].map((e) => path.join(cfgDir, `${X}.${e}`)).find((f) => fs.existsSync(f));
    const preParsed = configFile && fs.existsSync(configFile) ? parseConfig(configFile) : null;
    report.length = 0;
    const configIsEmpty = preParsed ? preParsed.order.every((v) => !Object.keys(preParsed.variations[v]).length) : false;
    if (wrapperFile && (!configFile || !fs.existsSync(configFile) || configIsEmpty)) {
        console.log(`Импорт ${X} как пустого компонента\n  wrapper: ${wrapperFile}\n  config: ${configFile && fs.existsSync(configFile) ? `${configFile} (без стилей)` : 'нет'}\n`);
        note('info', 'пустой компонент: вариаций и свойств нет, генератор соберёт обёртку `mergeConfig(config)` без локального конфига');
        for (const r of report) console.log(`  - ${r.text}`);
        console.log(args.apply ? '\nPatching seed files...' : '\nDry run (no files written). Add --apply to patch seeds.');
        const emptyParsed: Parsed = { defaults: {}, order: [], variations: {} };
        const emptyData = classify(emptyParsed, new Set(), new Map(), args.aliases, new Map());
        emitSeeds(args, [{ name: 'default', parsed: emptyParsed, data: emptyData }], emptyData.props, dbDir, undefined, true);
        if (args.apply) console.log(`\nДальше: docker exec db-service-dev npm run db:seed:prod -- --component=${X}`);
        return;
    }

    if (!fs.existsSync(tokensFile)) {
        console.error(`Токены ядра не найдены: ${tokensFile}\nЕсли токены лежат в подкомпонентах или файле tokens.ts, укажите --tokens=<file>.`);
        process.exit(1);
    }
    if (!configFile || !fs.existsSync(configFile)) {
        console.error(`Конфиг sdds-serv не найден в ${cfgDir}\nУкажите другой источник через --config=<file>.`);
        process.exit(1);
    }

    console.log(`Импорт ${X}\n  tokens: ${tokensFile}\n  config: ${configFile}\n`);

    coreVarByKey = readCoreTokens(tokensFile);
    const coreKeys = new Set(coreVarByKey.keys());
    const base = readBaseThemeTokens(seedsDir);
    const shapes = readShapeTokenPx(seedsDir);
    const parsed = parseConfig(configFile);
    for (const [axis, style] of Object.entries(args.defaultsOverride)) {
        if (!parsed.variations[axis]?.[style]) { console.error(`--default=${axis}=${style}: такого стиля в конфиге нет`); process.exit(1); }
        parsed.defaults[axis] = style;
        note('info', `${axis}: дефолт «${style}» задан через --default`);
    }
    for (const key of args.skipStyles) {
        const [axis, style] = key.split('.');
        if (!parsed.variations[axis]?.[style]) {
            console.error(`--skip-style=${key}: такого стиля в конфиге нет`);
            process.exit(1);
        }
        delete parsed.variations[axis][style];
        if (parsed.defaults[axis] === style) delete parsed.defaults[axis];
        note('skip', `${key}: стиль не перенесён по --skip-style, в пакете и панели вариаций его не будет`);
    }
    const coreDefaults = readCoreDefaults(X, args.plasma);
    parsed.defaults = mergeDefaults(parsed.defaults, coreDefaults, parsed.variations);
    const data = classify(parsed, coreKeys, base, args.aliases, shapes);

    const configDir = path.dirname(configFile);
    const stem = path.basename(configFile).replace(/\.config\.tsx?$/, '');
    for (const f of fs.readdirSync(configDir)) {
        // Соседние конфиги того же компонента (`X.clear.config.ts`) — второй appearance.
        if (f.startsWith(`${stem}.`) && /\.config\.tsx?$/.test(f) && path.join(configDir, f) !== configFile) {
            note('decision', `второй конфиг ${f} не импортирован: несколько appearance инструмент заводит только из папок (--dir)`);
        }
    }
    const usedKeys = new Set([...data.props.values()].flatMap((p) => p.web));
    const unused = [...coreKeys].filter((k) => !usedKeys.has(k));
    note('info', `токенов ядра всего ${coreKeys.size}, из них конфиг задаёт ${usedKeys.size}; без значения остаются ${unused.length}`);

    console.log(`defaults: ${JSON.stringify(parsed.defaults)}`);
    for (const v of data.order) console.log(`variation ${v}: ${Object.keys(parsed.variations[v]).join(', ')}`);
    const byType: Record<string, number> = {};
    for (const p of data.props.values()) byType[p.type] = (byType[p.type] ?? 0) + 1;
    console.log(`properties: ${data.props.size} (${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(', ')})`);
    console.log(`values: ${data.variationRows.length} in variations, ${data.invariantRows.length} invariants, ${[...data.props.values()].filter((p) => p.template).length} templated props\n`);

    const print = (kind: ReportEntry['kind'], title: string) => {
        const items = report.filter((r) => r.kind === kind);
        if (!items.length) return;
        console.log(`${title} (${items.length}):`);
        for (const r of items) console.log(`  - ${r.text}`);
        console.log();
    };
    print('decision', 'ТРЕБУЕТ РЕШЕНИЯ');
    print('approx', 'ПРИБЛИЖЕНИЯ');
    print('skip', 'ПРОПУЩЕНО');
    print('info', 'СПРАВКА');
    console.log(`  ${storyHints(args)}\n`);

    console.log(args.apply ? 'Patching seed files...' : 'Dry run (no files written). Add --apply to patch seeds.');
    const printed = report.length;
    emitSeeds(args, [{ name: 'default', parsed, data }], data.props, dbDir);
    for (const r of report.slice(printed)) console.log(`  - ${r.text}`);
    if (args.apply) {
        console.log(`\nДальше: docker exec db-service-dev npm run db:seed:prod -- --component=${X}`);
    }
}

main();
