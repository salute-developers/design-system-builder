import { describe, expect, it } from 'vitest';

import { buttonViewValues, buttonWebProps } from './__fixtures__/buttonSeed';
import {
    buildColorTokenViews,
    buildTree,
    collectContrastPairs,
    contrastRatio,
    fieldsInheritingFrom,
    newTokenMembers,
    parseMemberName,
    tokenNameFromLabel,
    type ComponentStyleSource,
    type ThemeTokenSource,
    type TokenGroupDto,
    type TokenPlacement,
} from '.';

const resolve = (value: string) => (value.includes('missing') ? null : '#3377FFFF');
const group = (id: string, label: string, position: number, parentId: string | null = null): TokenGroupDto => ({
    id,
    parentId,
    code: parentId ? null : id,
    label,
    position,
    kind: 'color',
});

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

const deps = (placements: Record<string, TokenPlacement> = {}) => ({
    resolve,
    placement: (name: string) => placements[name] ?? null,
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
    it('собирает семейство, метку ступени, наследование подтем и место в группе', () => {
        const tokens = [
            ...family('text', 'accent', '[general.blue.500][0.56]', '#FFFFFF'),
            { name: 'dark.text.default.accent-hover', type: 'color', displayName: 'h', enabled: true, web: '#000' },
            ...family('surface', 'transparent-card', '#00000014', '#FFFFFF14', { 'on-dark.dark': '#123456' }),
            ...family('background', 'primary', '#FFFFFF', '#000000'),
        ] satisfies ThemeTokenSource[];
        const [accent, card, background] = buildColorTokenViews(
            tokens,
            deps({ 'text.default.accent': { groupId: 'accent', position: 2, publishedIn: '1.0.0' } }),
        );

        expect(accent.id).toBe('color:text.accent');
        expect(accent.displayName).toBe('textAccent');
        expect(accent.modes.light).toMatchObject({ paletteLabel: 'Blue 500', opacity: 0.56, resolved: '#3377FFFF' });
        expect(accent).toMatchObject({ groupId: 'accent', position: 2, publishedIn: '1.0.0' });
        expect(accent.contexts.inverse.linked).toBe(true);
        expect(card.contexts.ondark.linked).toBe(false);
        expect(card.contexts.onlight.linked).toBe(true);
        expect(card.modes.dark.opacity).toBe(0.08);
        expect(background).toMatchObject({ groupId: null, position: 0, publishedIn: null });
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
    const groups = [
        group('text', 'Text & Icons', 0),
        group('outline', 'Outlines', 1),
        group('accent', 'Accent', 0, 'text'),
        group('status', 'Status', 1, 'text'),
    ];
    const views = buildColorTokenViews(
        [
            ...family('text', 'secondary', '#000', '#FFF'),
            ...family('text', 'accent', 'bad', '#FFF'),
            ...family('text', 'primary', '#000', '#FFF'),
            ...family('text', 'orphan', '#000', '#FFF'),
            ...family('outline', 'primary', '#000', '#FFF'),
            ...family('data', 'yellow', '#000', '#FFF'),
        ],
        deps({
            'text.default.secondary': { groupId: 'accent', position: 0, publishedIn: null },
            'text.default.accent': { groupId: 'accent', position: 1, publishedIn: null },
            'text.default.primary': { groupId: 'text', position: 0, publishedIn: null },
            'outline.default.primary': { groupId: 'outline', position: 0, publishedIn: null },
        }),
    );
    const names = (tokens: { displayName: string }[]) => tokens.map((token) => token.displayName);

    it('строит группы, токены группы, подгруппы, пустые узлы и «Без группы»', () => {
        const tree = buildTree(groups, views, { query: '', sort: 'source', issuesOnly: false });
        expect(tree.map((node) => node.group.label)).toEqual(['Text & Icons', 'Outlines', 'Без группы']);
        expect(names(tree[0].tokens)).toEqual(['textPrimary']);
        expect(tree[0].subgroups.map((item) => item.group.label)).toEqual(['Accent', 'Status', 'Без группы']);
        expect(names(tree[0].subgroups[0].tokens)).toEqual(['textSecondary', 'textAccent']);
        expect(tree[0].subgroups[1].tokens).toEqual([]);
        expect(names(tree[0].subgroups[2].tokens)).toEqual(['textOrphan']);
        expect(names(tree[2].tokens)).toEqual(['dataYellow']);
    });

    it('сортирует «А–Я» внутри узла', () => {
        const tree = buildTree(groups, views, { query: '', sort: 'az', issuesOnly: false });
        expect(names(tree[0].subgroups[0].tokens)).toEqual(['textAccent', 'textSecondary']);
    });

    it('при поиске и фильтре показывает только узлы с найденными токенами', () => {
        const found = buildTree(groups, views, { query: 'OUTLINE', sort: 'az', issuesOnly: false });
        expect(found.map((node) => node.group.label)).toEqual(['Outlines']);
        const issues = buildTree(groups, views, { query: '', sort: 'az', issuesOnly: true });
        expect(issues.map((node) => node.group.label)).toEqual(['Text & Icons']);
        expect(issues[0].subgroups.map((item) => item.group.label)).toEqual(['Accent']);
        expect(buildTree(groups, views, { query: 'нет такого', sort: 'az', issuesOnly: false })).toEqual([]);
    });
});

describe('новый токен', () => {
    const taken = new Set(['text.accent']);

    it('приводит имя к kebab-case и показывает ошибки', () => {
        expect(tokenNameFromLabel('Card Header', 'text', taken)).toEqual({ name: 'card-header' });
        expect(tokenNameFromLabel('Привет', 'text', taken)).toEqual({ error: 'Введите имя: латиница и цифры.' });
        expect(tokenNameFromLabel('Accent', 'text', taken)).toEqual({ error: 'Имя accent уже занято.' });
        expect(tokenNameFromLabel('accent hover', 'text', taken)).toEqual({
            error: 'Имя не может оканчиваться на -hover, -active или -brightness.',
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
    /** Стили вариации `view` кнопки базовой дизайн-системы (фикстура). */
    const buttonStyles = (): ComponentStyleSource[] => {
        const web = buttonWebProps;
        return Object.entries(buttonViewValues).map(([style, entries]) => {
            const props = new Map<string, { token: string; states: Array<{ state: string; token?: string }> }>();
            for (const entry of entries) {
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
