import { describe, expect, it } from 'vitest';

import { values as buttonValues } from '../../../../../../services/db-service/src/db/seeds/prod/components/button/values';
import { properties as buttonProperties } from '../../../../../../services/db-service/src/db/seeds/prod/components/button/properties';
import {
    buildColorTokenViews,
    buildTree,
    boardCategories,
    collectContrastPairs,
    contrastRatio,
    fieldsInheritingFrom,
    newTokenMembers,
    normalizeNewToken,
    parseMemberName,
    type ComponentStyleSource,
    type PaletteCategory,
    type ThemeTokenSource,
} from '.';

const resolve = (value: string) => (value.includes('missing') ? null : '#3377FFFF');
const groups: Record<string, PaletteCategory> = {
    neutral: { id: 'g-neutral', systemKey: 'neutral', label: 'Neutral' },
    accent: { id: 'g-accent', systemKey: 'accent', label: 'Accent' },
    brand: { id: 'g-brand', systemKey: null, label: 'Brand' },
};

const family = (group: string, name: string, light: string, dark: string, overrides: Record<string, string> = {}) => {
    const subgroups =
        group === 'background'
            ? ['default', 'dark', 'light', 'inverse']
            : ['default', 'on-dark', 'on-light', 'inverse'];
    const inherited: Record<string, Record<string, string>> = {
        default: { light, dark },
        [subgroups[1]]: { light: dark, dark },
        [subgroups[2]]: { light, dark: light },
        inverse: { light: dark, dark: light },
    };
    return subgroups.flatMap((subgroup) =>
        (['light', 'dark'] as const).map(
            (mode): ThemeTokenSource => ({
                name: `${mode}.${group}.${subgroup}.${name}`,
                type: 'color',
                displayName: subgroup === 'default' ? `${group}${name[0].toUpperCase()}${name.slice(1)}` : 'x',
                description: 'Описание',
                enabled: true,
                web: overrides[`${subgroup}.${mode}`] ?? inherited[subgroup][mode],
            }),
        ),
    );
};

const deps = (assign: Record<string, PaletteCategory> = {}) => ({
    resolve,
    paletteGroup: (name: string) => assign[name] ?? (name.includes('accent') ? groups.accent : groups.neutral),
    incomplete: new Set<string>(),
});

describe('семейство токена', () => {
    it('разбирает режим, подгруппу и состояние', () => {
        expect(parseMemberName('dark.text.on-dark.accent-minor-hover')).toEqual({
            mode: 'dark',
            group: 'text',
            subgroup: 'on-dark',
            name: 'accent-minor',
            state: 'hover',
        });
        expect(parseMemberName('text.accent')).toBeNull();
    });

    it('правка Light меняет OnLight Light, OnLight Dark и Inverse Dark', () => {
        expect(fieldsInheritingFrom('light')).toEqual([
            { context: 'onlight', mode: 'light' },
            { context: 'onlight', mode: 'dark' },
            { context: 'inverse', mode: 'dark' },
        ]);
    });
});

describe('токены экрана', () => {
    it('собирает семейство, метку ступени, наследование подтем и категорию по группе палитры', () => {
        const tokens = [
            ...family('text', 'accent', '[general.blue.500][0.56]', '#FFFFFF'),
            { name: 'dark.text.default.accent-hover', type: 'color', displayName: 'h', enabled: true, web: '#000' },
            ...family('surface', 'transparent-card', '#00000014', '#FFFFFF14', { 'on-dark.dark': '#123456' }),
            ...family('background', 'primary', '#FFFFFF', '#000000'),
        ] satisfies ThemeTokenSource[];
        const [accent, card, background] = buildColorTokenViews(tokens, deps());

        expect(accent.id).toBe('color:text.accent');
        expect(accent.displayName).toBe('textAccent');
        expect(accent.modes.light).toMatchObject({ paletteLabel: 'Blue 500', opacity: 0.56, resolved: '#3377FFFF' });
        expect(accent.category).toBe('Accent');
        expect(accent.contexts.inverse.linked).toBe(true);
        expect(card.category).toBe('General / Transparent');
        expect(card.contexts.ondark.linked).toBe(false);
        expect(card.contexts.onlight.linked).toBe(true);
        expect(card.modes.dark.opacity).toBe(0.08);
        expect(background.section).toBe('background');
        expect(background.category).toBe('Default');
    });

    it('явная привязка к пользовательской группе меняет категорию', () => {
        const [view] = buildColorTokenViews(
            family('surface', 'highlight', '#FFFFFF', '#000000'),
            deps({ 'surface.default.highlight': groups.brand }),
        );
        expect(view.category).toBe('Brand / Solid');
        expect(view.paletteGroupId).toBe('g-brand');
    });

    it('отмечает неполный токен и значения, которые не пройдут проверку', () => {
        const tokens = family('text', 'primary', 'blue', '[general.missing.500]').filter(
            (token) => !token.name.startsWith('light.text.inverse'),
        );
        const [view] = buildColorTokenViews(tokens, deps());
        expect(view.incomplete).toBe(true);
        expect(view.issues.map((issue) => issue.field)).toContain('light');
        expect(view.issues.find((issue) => issue.field === 'dark')?.message).toBe(
            'Ступени Missing 500 нет в палитре темы.',
        );
    });
});

describe('дерево', () => {
    const views = buildColorTokenViews(
        [
            ...family('text', 'secondary', '#000', '#FFF'),
            ...family('text', 'accent', 'bad', '#FFF'),
            ...family('outline', 'primary', '#000', '#FFF'),
        ],
        deps(),
    );

    it('сортирует «А–Я» внутри раздела и сохраняет исходный порядок по «Исходные»', () => {
        expect(
            buildTree(views, { query: '', sort: 'az', issuesOnly: false })[0].tokens.map((t) => t.displayName),
        ).toEqual(['textAccent', 'textSecondary']);
        expect(
            buildTree(views, { query: '', sort: 'source', issuesOnly: false })[0].tokens.map((t) => t.displayName),
        ).toEqual(['textSecondary', 'textAccent']);
    });

    it('ищет без учёта регистра, фильтрует проблемы и не выводит пустые разделы', () => {
        expect(buildTree(views, { query: 'OUTLINE', sort: 'az', issuesOnly: false }).map((s) => s.section)).toEqual([
            'outline',
        ]);
        expect(
            buildTree(views, { query: '', sort: 'az', issuesOnly: true })[0].tokens.map((t) => t.displayName),
        ).toEqual(['textAccent']);
        expect(buildTree(views, { query: 'нет такого', sort: 'az', issuesOnly: false })).toEqual([]);
    });

    it('группирует борд по категориям', () => {
        const text = views.filter((view) => view.section === 'text');
        expect(boardCategories(text).map((item) => item.category)).toEqual(['General', 'Accent']);
    });
});

describe('новый токен', () => {
    const existing = new Set(['text.accent']);

    it('приводит имя к kebab-case и добавляет transparent- для категории Transparent', () => {
        expect(
            normalizeNewToken(
                { section: 'text', surfaceKind: null, name: 'Card Header', light: '#FFF', dark: '#000' },
                existing,
            ),
        ).toEqual({
            key: { type: 'color', group: 'text', name: 'card-header' },
            displayName: 'textCardHeader',
        });
        expect(
            normalizeNewToken(
                { section: 'surface', surfaceKind: 'Transparent', name: 'banner', light: '#FFF', dark: '#000' },
                existing,
            ),
        ).toMatchObject({
            key: { group: 'surface', name: 'transparent-banner' },
            displayName: 'surfaceTransparentBanner',
        });
    });

    it('показывает тексты ошибок прототипа', () => {
        const input = { section: 'text' as const, surfaceKind: null, light: '#FFF', dark: '#000' };
        expect(normalizeNewToken({ ...input, name: 'Привет' }, existing)).toEqual({
            error: 'Введите имя токена: латиница и цифры.',
        });
        expect(normalizeNewToken({ ...input, name: 'accent' }, existing)).toEqual({
            error: 'Токен textAccent уже есть в теме.',
        });
        expect(normalizeNewToken({ ...input, name: 'new', dark: 'black' }, existing)).toEqual({
            error: 'Значения Light и Dark должны быть цветом в формате Hex.',
        });
        expect(normalizeNewToken({ ...input, name: 'accent hover' }, existing)).toEqual({
            error: 'Имя токена не может оканчиваться на -hover, -active или -brightness.',
        });
    });

    it('собирает подтемы с наследованием и состояния', () => {
        const members = newTokenMembers(
            { type: 'color', group: 'text', name: 'highlight' },
            { light: '#111', dark: '#EEE' },
            (value, _g, _s, mode, state) => `${value}:${mode}:${state}`,
        );
        expect(members).toHaveLength(12);
        const byName = Object.fromEntries(members.map((member) => [member.name, member.values]));
        expect(byName['text.inverse.highlight']).toEqual([
            { mode: 'light', value: '#EEE' },
            { mode: 'dark', value: '#111' },
        ]);
        expect(byName['text.on-dark.highlight-hover']).toEqual([
            { mode: 'light', value: '#EEE:light:hover' },
            { mode: 'dark', value: '#EEE:dark:hover' },
        ]);
        const bg = newTokenMembers(
            { type: 'color', group: 'background', name: 'banner' },
            { light: '#111', dark: '#EEE' },
            () => '',
        );
        expect(bg.map((member) => member.name)).toEqual([
            'background.default.banner',
            'background.dark.banner',
            'background.light.banner',
            'background.inverse.banner',
        ]);
    });
});

describe('пары контраста', () => {
    /** Стили вариации `view` сида кнопки db-service. */
    const buttonStyles = (): ComponentStyleSource[] => {
        const web = new Set(buttonProperties.filter((item) => item.params.web).map((item) => item.name));
        return Object.entries(buttonValues.view ?? {}).map(([style, entries]) => {
            const props = new Map<string, { token: string; states: Array<{ state: string; token?: string }> }>();
            for (const entry of entries as Array<{ prop: string; token?: string; state?: string }>) {
                if (!entry.token) continue;
                const prop = props.get(entry.prop) ?? { token: '', states: [] };
                if (entry.state) prop.states.push({ state: entry.state, token: entry.token });
                else prop.token = entry.token;
                props.set(entry.prop, prop);
            }
            return {
                component: 'Button',
                variation: 'view',
                style,
                props: [...props.entries()]
                    .filter(([, prop]) => prop.token)
                    .map(([name, prop]) => ({ name, token: prop.token, states: prop.states, web: web.has(name) })),
            };
        });
    };
    const colors: Record<string, string> = {
        'surface.default.accent': '#1A73E8',
        'surface.default.accent-hover': '#1765CC',
        'text.on-dark.primary': '#FFFFFFF5',
        'background.default.primary': '#000000',
    };
    const resolveTheme = (name: string) => colors[name.replace(/^(light|dark)\./, '')] ?? '#808080';

    it('находит пары токена в стилях кнопки по web-свойствам и состояниям', () => {
        const pairs = collectContrastPairs(
            buttonStyles(),
            { type: 'color', group: 'surface', name: 'accent' },
            resolveTheme,
        );
        const accent = pairs.filter((pair) => pair.style === 'accent');
        expect(accent.length).toBeGreaterThan(0);
        expect(new Set(accent.map((pair) => pair.backgroundToken))).toContain('surface.default.accent-hover');
        expect(accent.some((pair) => pair.foregroundToken.includes('icon'))).toBe(false);
        const label = accent.find(
            (pair) =>
                pair.state === 'Default' && pair.mode === 'dark' && pair.foregroundToken === 'text.on-dark.primary',
        );
        expect(label).toMatchObject({ kind: 'text', threshold: 4.5 });
        expect(label?.ratio).toBeCloseTo(contrastRatio('#FFFFFFF5', '#1A73E8', '#000000') ?? 0, 2);
    });

    it('накладывает прозрачность и считает 21 для чёрного на белом', () => {
        expect(contrastRatio('#000000', '#FFFFFF', '#FFFFFF')).toBe(21);
        expect(contrastRatio('#00000000', '#FFFFFF', '#FFFFFF')).toBe(1);
        expect(contrastRatio('nope', '#FFFFFF', null)).toBeNull();
    });
});
