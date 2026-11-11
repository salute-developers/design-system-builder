import { describe, expect, it } from 'vitest';

import type { ExportPlan } from '../shared/exportPlan';
import { applyExportPlan, same, gradientTransform, type ExportFigmaApi } from './applyExportPlan';

class Keyed {
    private readonly data = new Map<string, string>();
    getSharedPluginData(namespace: string, key: string) {
        return this.data.get(`${namespace}:${key}`) ?? '';
    }
    setSharedPluginData(namespace: string, key: string, value: string) {
        this.data.set(`${namespace}:${key}`, value);
    }
}

let lastId = 0;
const nextId = (prefix: string) => `${prefix}:${++lastId}`;

class FakeCollection extends Keyed {
    readonly id = nextId('collection');
    modes = [{ modeId: nextId('mode'), name: 'Mode 1' }];
    constructor(
        public name: string,
        private readonly limit: number,
    ) {
        super();
    }
    addMode(name: string) {
        if (this.modes.length >= this.limit) throw new Error(`Limited to ${this.limit} modes only`);
        const modeId = nextId('mode');
        this.modes.push({ modeId, name });
        return modeId;
    }
    renameMode(modeId: string, name: string) {
        this.modes.find((mode) => mode.modeId === modeId)!.name = name;
    }
}

/** Как в Figma: имя переменной уникально в коллекции. */
class FakeVariable extends Keyed {
    readonly id = nextId('variable');
    scopes: string[] = [];
    valuesByMode: Record<string, unknown> = {};
    private current = '';
    constructor(
        name: string,
        readonly variableCollectionId: string,
        readonly resolvedType: string,
        private readonly siblings: FakeVariable[],
    ) {
        super();
        this.name = name;
    }
    get name() {
        return this.current;
    }
    set name(value: string) {
        const taken = this.siblings.some(
            (item) => item !== this && item.variableCollectionId === this.variableCollectionId && item.name === value,
        );
        if (taken) throw new Error(`duplicate variable name ${value}`);
        this.current = value;
    }
    setValueForMode(modeId: string, value: unknown) {
        this.valuesByMode[modeId] = value;
    }
}

class FakeStyle extends Keyed {
    name = '';
    effects: unknown[] = [];
    paints: unknown[] = [];
    fontName: unknown = null;
    fontSize = 0;
    lineHeight: unknown = null;
    letterSpacing: unknown = null;
    bound: Record<string, string> = {};
    setBoundVariable(field: string, variable: FakeVariable | null) {
        if (variable) this.bound[field] = variable.id;
        else delete this.bound[field];
    }
}

const createFigma = ({ modeLimit = 10, families = ['SB Sans Display'] } = {}) => {
    const collections: FakeCollection[] = [];
    const variables: FakeVariable[] = [];
    const textStyles: FakeStyle[] = [];
    const effectStyles: FakeStyle[] = [];
    const paintStyles: FakeStyle[] = [];
    const style = (list: FakeStyle[]) => () => {
        const created = new FakeStyle();
        list.push(created);
        return created;
    };
    const api = {
        variables: {
            getLocalVariableCollectionsAsync: async () => [...collections],
            getLocalVariablesAsync: async () => [...variables],
            createVariableCollection: (name: string) => {
                const created = new FakeCollection(name, modeLimit);
                collections.push(created);
                return created;
            },
            createVariable: (name: string, collection: FakeCollection, type: string) => {
                const created = new FakeVariable(name, collection.id, type, variables);
                variables.push(created);
                return created;
            },
            createVariableAlias: (variable: FakeVariable) => ({ type: 'VARIABLE_ALIAS', id: variable.id }),
            setBoundVariableForPaint: (paint: object, field: string, variable: FakeVariable) => ({
                ...paint,
                boundVariables: { [field]: { type: 'VARIABLE_ALIAS', id: variable.id } },
            }),
            setBoundVariableForEffect: (effect: object, field: string, variable: FakeVariable) => ({
                ...effect,
                boundVariables: { [field]: { type: 'VARIABLE_ALIAS', id: variable.id } },
            }),
        },
        getLocalTextStylesAsync: async () => [...textStyles],
        getLocalEffectStylesAsync: async () => [...effectStyles],
        getLocalPaintStylesAsync: async () => [...paintStyles],
        createTextStyle: style(textStyles),
        createEffectStyle: style(effectStyles),
        createPaintStyle: style(paintStyles),
        listAvailableFontsAsync: async () =>
            families.flatMap((family) =>
                ['Regular', 'Semibold', 'Bold Italic'].map((fontStyle) => ({ fontName: { family, style: fontStyle } })),
            ),
        loadFontAsync: async () => undefined,
    };
    return {
        figma: api as unknown as ExportFigmaApi,
        collections,
        variables,
        textStyles,
        effectStyles,
        paintStyles,
    };
};

const color = (r: number, a = 1) => ({ r, g: 0, b: 0, a });

const createPlan = (themeName = 'Text&Icons/Default/General/Primary'): ExportPlan => ({
    source: { themeName: 'Malachite', tenantId: 'tenant', versionId: null, designSystemId: 'ds-a' },
    collections: [
        {
            key: 'collection:palette',
            name: '00. Palette',
            modes: [{ key: 'default', name: 'Default' }],
            variables: [
                {
                    key: 'palette:neutral:general.gray.950',
                    name: 'Neutral/Gray/950',
                    type: 'COLOR',
                    scopes: [],
                    values: { default: { kind: 'color', ...color(0.1) } },
                },
            ],
        },
        {
            key: 'collection:theme',
            name: '01. Theme',
            modes: [
                { key: 'light', name: 'Light' },
                { key: 'dark', name: 'Dark' },
            ],
            variables: [
                {
                    key: 'theme:t1',
                    name: themeName,
                    type: 'COLOR',
                    scopes: [],
                    values: {
                        light: { kind: 'alias', key: 'palette:neutral:general.gray.950' },
                        dark: { kind: 'alias', key: 'palette:neutral:general.gray.950', opacity: 16 },
                    },
                },
            ],
        },
        {
            key: 'collection:typography',
            name: '03. Typography',
            modes: [{ key: 'screen-l', name: 'Large' }],
            variables: [
                {
                    key: 'font-family:header',
                    name: 'FontFamily/Header',
                    type: 'STRING',
                    scopes: ['FONT_FAMILY'],
                    values: { 'screen-l': { kind: 'string', value: 'SB Sans Display' } },
                },
                {
                    key: 'typography:header.h1.bold:size',
                    name: 'Header/H1 B/Font Size',
                    type: 'FLOAT',
                    scopes: ['FONT_SIZE'],
                    values: { 'screen-l': { kind: 'number', value: 48 } },
                },
            ],
        },
    ],
    textStyles: [
        {
            key: 'text-style:header.h1.bold',
            name: 'Header/H1 B',
            fontFamily: 'SB Sans Display',
            fontWeight: 600,
            fontSize: 48,
            lineHeight: 52,
            letterSpacing: -0.96,
            bindings: { fontSize: 'typography:header.h1.bold:size', fontFamily: 'font-family:header' },
        },
    ],
    effectStyles: [
        {
            key: 'shadow:s1',
            name: 'Shadows/Down/Soft/S',
            shadows: [{ x: 0, y: 4, blur: 14, spread: -4, color: color(0, 0.08) }],
        },
    ],
    paintStyles: [
        {
            key: 'gradient:t9:dark',
            name: 'Dark/Surfaces/Default/Accent/Solid/AccentGradient',
            paints: [
                { kind: 'solid', color: color(1, 0.5) },
                {
                    kind: 'linear',
                    angle: 90,
                    stops: [
                        { position: 0, color: color(0) },
                        { position: 1, color: color(1) },
                    ],
                },
            ],
        },
    ],
    skipped: [],
    notes: [
        {
            name: 'surface.default.card',
            reason: 'градиент описан парой стилей Light и Dark: в режимах разное число слоёв',
        },
    ],
    omitted: { disabled: 1 },
});

describe('запись плана экспорта', () => {
    it('создаёт коллекции, режимы, ссылки и стили в пустом файле', async () => {
        const { figma, collections, variables, textStyles, effectStyles, paintStyles } = createFigma();

        const report = await applyExportPlan(createPlan(), figma);

        expect(report.failure).toBeUndefined();
        expect(collections.map((item) => item.name)).toEqual(['00. Palette', '01. Theme', '03. Typography']);
        expect(collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Dark']);
        const [palette, theme] = variables;
        const [light, dark] = collections[1].modes.map((mode) => theme.valuesByMode[mode.modeId]);
        expect(light).toEqual({ type: 'VARIABLE_ALIAS', id: palette.id });
        expect(dark).toEqual({ color: { type: 'VARIABLE_ALIAS', id: palette.id }, opacity: 16 });
        expect(theme.getSharedPluginData('dsbuilder', 'key')).toBe('theme:t1');
        expect(report.created).toEqual({
            collections: 3,
            variables: 4,
            textStyles: 1,
            effectStyles: 1,
            paintStyles: 1,
        });
        expect(report.omitted).toEqual({ disabled: 1 });
        expect(report.missingFonts).toEqual([]);

        expect(textStyles[0].fontName).toEqual({ family: 'SB Sans Display', style: 'Semibold' });
        expect(textStyles[0].letterSpacing).toEqual({ unit: 'PIXELS', value: -0.96 });
        expect(textStyles[0].bound).toEqual({ fontFamily: variables[2].id, fontSize: variables[3].id });
        expect(effectStyles[0].effects).toEqual([
            expect.objectContaining({ type: 'DROP_SHADOW', radius: 14, spread: -4, offset: { x: 0, y: 4 } }),
        ]);
        // Верхний слой CSS — последний в Figma.
        expect(paintStyles[0].paints.map((paint) => (paint as { type: string }).type)).toEqual([
            'GRADIENT_LINEAR',
            'SOLID',
        ]);
        // Непривязанный сплошной слой хранит прозрачность в самом слое.
        expect((paintStyles[0].paints[1] as { opacity: number }).opacity).toBe(0.5);
        expect(report.notes).toEqual(createPlan().notes);
    });

    it('при повторном экспорте обновляет найденное по ключу и не создаёт дубликатов', async () => {
        const { figma, collections, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);

        const report = await applyExportPlan(createPlan('Text&Icons/Default/General/Main'), figma);

        expect(collections).toHaveLength(3);
        expect(variables).toHaveLength(4);
        expect(collections[1].modes).toHaveLength(2);
        expect(variables[1].name).toBe('Text&Icons/Default/General/Main');
        expect(report.created.variables).toBe(0);
        expect(report.updated).toEqual({
            collections: 3,
            variables: 4,
            textStyles: 1,
            effectStyles: 1,
            paintStyles: 1,
        });
    });

    it('считает устаревшими объекты DS Builder, которых нет в плане, и не удаляет их', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const plan = createPlan();
        plan.collections[2].variables.pop();
        plan.effectStyles = [];

        const report = await applyExportPlan(plan, figma);

        expect(variables).toHaveLength(4);
        expect(report.stale).toEqual({ collections: 0, variables: 1, textStyles: 0, effectStyles: 1, paintStyles: 0 });
    });

    it('прекращает запись с причиной, если тариф не разрешает режим', async () => {
        const { figma, collections, variables } = createFigma({ modeLimit: 1 });

        const report = await applyExportPlan(createPlan(), figma);

        expect(report.failure).toContain('режим «Dark»');
        expect(report.failure).toContain('ограничено тарифом');
        expect(collections.map((item) => item.name)).toEqual(['00. Palette', '01. Theme']);
        // Режимы проверяются раньше переменных: переменных без значений в файле не остаётся.
        expect(variables).toHaveLength(0);
    });

    it('обновляет значение при повторном экспорте', async () => {
        const { figma, collections, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const plan = createPlan();
        plan.collections[0].variables[0].values.default = { kind: 'color', ...color(0.5) };

        await applyExportPlan(plan, figma);

        const [palette] = variables;
        expect(palette.valuesByMode[collections[0].modes[0].modeId]).toEqual(color(0.5));
        expect(variables).toHaveLength(4);
    });

    it('меняет местами имена двух переменных без ошибки', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const swapped = createPlan();
        const [family, size] = swapped.collections[2].variables;
        [family.name, size.name] = [size.name, family.name];

        const report = await applyExportPlan(swapped, figma);

        expect(report.failure).toBeUndefined();
        expect(variables.map((item) => item.name).slice(2)).toEqual(['Header/H1 B/Font Size', 'FontFamily/Header']);
    });

    it('передаёт переменную с тем же именем новому ключу, и привязки не теряются', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const before = variables.find((item) => item.name === 'Text&Icons/Default/General/Primary')!;
        const recreated = createPlan();
        recreated.collections[1].variables[0].key = 'theme:t1-new';

        const report = await applyExportPlan(recreated, figma);

        expect(report.failure).toBeUndefined();
        expect(variables).toHaveLength(4);
        expect(before.getSharedPluginData('dsbuilder', 'key')).toBe('theme:t1-new');
        expect(report.updated.variables).toBe(4);
        expect(report.stale.variables).toBe(0);
    });

    it('не передаёт новому ключу переменную другой дизайн-системы того же файла', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const other = createPlan();
        other.source.designSystemId = 'ds-b';
        other.collections[1].variables[0].key = 'theme:b1';

        const report = await applyExportPlan(other, figma);

        expect(report.failure).toBeUndefined();
        expect(variables.map((item) => item.name)).toContain('Text&Icons/Default/General/Primary (устарело)');
        expect(report.stale.variables).toBe(1);
    });

    it('освобождает имя от устаревшей переменной DS Builder другого типа', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const recreated = createPlan();
        const size = recreated.collections[2].variables[1];
        Object.assign(size, {
            key: 'typography:new',
            type: 'STRING',
            values: { 'screen-l': { kind: 'string', value: '48' } },
        });

        const report = await applyExportPlan(recreated, figma);

        expect(report.failure).toBeUndefined();
        expect(variables.map((item) => item.name)).toContain('Header/H1 B/Font Size (устарело)');
        expect(variables.filter((item) => item.name === 'Header/H1 B/Font Size')).toHaveLength(1);
        expect(report.stale.variables).toBe(1);
    });

    it('пропускает переменную, если её имя занято переменной не из DS Builder', async () => {
        const { figma, collections, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        variables[3].name = 'Header/H1 B/Size (свой)';
        const foreign = figma.variables.createVariable(
            'Header/H1 B/Font Size',
            collections[2] as unknown as VariableCollection,
            'FLOAT',
        );

        const report = await applyExportPlan(createPlan(), figma);

        expect(foreign.name).toBe('Header/H1 B/Font Size');
        expect(variables[3].name).toBe('Header/H1 B/Size (свой)');
        expect(report.skipped).toContainEqual({
            name: 'Header/H1 B/Font Size',
            reason: 'имя занято переменной, созданной не DS Builder',
        });
    });

    it('пропускает второй объект плана с тем же именем и не помечает первый устаревшим', async () => {
        const { figma, variables } = createFigma();
        const plan = createPlan();
        plan.collections[0].variables.push({ ...plan.collections[0].variables[0], key: 'palette:other' });
        await applyExportPlan(plan, figma);

        const report = await applyExportPlan(plan, figma);

        expect(variables.map((item) => item.name)).not.toContain('Neutral/Gray/950 (устарело)');
        expect(report.skipped).toContainEqual({
            name: 'Neutral/Gray/950',
            reason: 'в плане два объекта с этим именем',
        });
    });

    it('возвращает прежние имена, если Figma отказала посреди записи', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const renamed = createPlan('Text&Icons/Default/General/Main');
        renamed.collections[2].variables.push({ ...renamed.collections[2].variables[1], key: 'typography:new' });
        renamed.collections[2].variables[2].name = 'Header/H1 B/Line Height';
        const create = figma.variables.createVariable;
        figma.variables.createVariable = () => {
            throw new Error('locked');
        };

        const report = await applyExportPlan(renamed, figma);
        figma.variables.createVariable = create;

        expect(report.failure).toBe('Figma отказала: Error: locked');
        expect(variables.map((item) => item.name)).not.toContainEqual(expect.stringMatching(/^dsbuilder-tmp\//));
        expect(variables[1].name).toBe('Text&Icons/Default/General/Main');
    });

    it('не начинает цепочку переименований, конец которой упирается в чужое имя', async () => {
        const { figma, collections, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const [, , family, size] = variables;
        figma.variables.createVariable('Taken', collections[2] as unknown as VariableCollection, 'FLOAT');
        const plan = createPlan();
        // Цепочка `family → имя size`, `size → Taken`: Taken занято дизайнером, поэтому не переименовывается никто.
        plan.collections[2].variables[1].name = 'Taken';
        plan.collections[2].variables[0].name = 'Header/H1 B/Font Size';

        const report = await applyExportPlan(plan, figma);

        expect(family.name).toBe('FontFamily/Header');
        expect(size.name).toBe('Header/H1 B/Font Size');
        expect(variables.map((item) => item.name)).not.toContainEqual(expect.stringMatching(/устарело|dsbuilder-tmp/));
        expect(report.skipped).toEqual(
            expect.arrayContaining([
                { name: 'Taken', reason: 'имя занято переменной, созданной не DS Builder' },
                { name: 'Header/H1 B/Font Size', reason: 'имя занято переменной плана, которую нельзя переименовать' },
            ]),
        );
    });

    it('не переименовывает переменную в имя, которое в плане носят два объекта', async () => {
        const { figma, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const [, , family, size] = variables;
        const plan = createPlan();
        const typography = plan.collections[2].variables;
        // Новая переменная первой занимает `N`, `size` тоже хочет `N`, а `family` — прежнее имя `size`.
        typography.unshift({ ...typography[1], key: 'typography:new', name: 'N' });
        typography[2].name = 'N';
        typography[1].name = 'Header/H1 B/Font Size';

        const report = await applyExportPlan(plan, figma);

        expect(family.name).toBe('FontFamily/Header');
        expect(size.name).toBe('Header/H1 B/Font Size');
        expect(variables.map((item) => item.name)).not.toContainEqual(expect.stringMatching(/устарело|dsbuilder-tmp/));
        expect(report.skipped).toContainEqual({ name: 'N', reason: 'в плане два объекта с этим именем' });
    });

    it('называет причиной пропуска новой переменной заблокированное переименование', async () => {
        const { figma, collections, variables } = createFigma();
        await applyExportPlan(createPlan(), figma);
        figma.variables.createVariable('Taken', collections[2] as unknown as VariableCollection, 'FLOAT');
        const plan = createPlan();
        const typography = plan.collections[2].variables;
        typography[1].name = 'Taken';
        typography.push({ ...typography[1], key: 'typography:new', name: 'Header/H1 B/Font Size' });

        const report = await applyExportPlan(plan, figma);

        expect(variables[3].name).toBe('Header/H1 B/Font Size');
        expect(report.skipped).toContainEqual({
            name: 'Header/H1 B/Font Size',
            reason: 'имя занято переменной плана, которую нельзя переименовать',
        });
    });

    it('сохраняет добавленный режим в соответствии, даже если Figma не дала его переименовать', async () => {
        const { figma, collections } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const plan = createPlan();
        plan.collections[1].modes.push({ key: 'contrast', name: 'Contrast' });
        const rename = collections[1].renameMode.bind(collections[1]);
        collections[1].renameMode = (modeId, name) => {
            if (name === 'Contrast') throw new Error('locked');
            rename(modeId, name);
        };
        await applyExportPlan(plan, figma);
        collections[1].renameMode = rename;

        await applyExportPlan(plan, figma);

        expect(collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Dark', 'Contrast']);
    });

    it('сохраняет соответствие добавленных режимов, если тариф отказал на следующем', async () => {
        const { figma, collections } = createFigma({ modeLimit: 3 });
        await applyExportPlan(createPlan(), figma);
        const plan = createPlan();
        plan.collections[1].modes.push({ key: 'contrast', name: 'Contrast' }, { key: 'extra', name: 'Extra' });

        const first = await applyExportPlan(plan, figma);
        const second = await applyExportPlan(plan, figma);

        expect(first.failure).toContain('режим «Extra»');
        // Повторный экспорт узнаёт добавленный Contrast и упирается в лимит снова только на Extra.
        expect(second.failure).toContain('режим «Extra»');
        expect(collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Dark', 'Contrast']);
    });

    it('не занимает режим, добавленный дизайнером, когда соответствие уже сохранено', async () => {
        const { figma, collections } = createFigma();
        await applyExportPlan(createPlan(), figma);
        const designerMode = collections[1].addMode('Brand');
        collections[1].modes = collections[1].modes.filter((mode) => mode.name !== 'Dark');

        await applyExportPlan(createPlan(), figma);

        expect(collections[1].modes.find((mode) => mode.modeId === designerMode)?.name).toBe('Brand');
        expect(collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Brand', 'Dark']);
    });

    it('восстанавливает удалённый режим коллекции при повторном экспорте', async () => {
        const { figma, collections } = createFigma();
        await applyExportPlan(createPlan(), figma);
        collections[1].modes.pop();

        const report = await applyExportPlan(createPlan(), figma);

        expect(report.failure).toBeUndefined();
        expect(collections[1].modes.map((mode) => mode.name)).toEqual(['Light', 'Dark']);
    });

    it('сообщает, что редактор без переменных не поддерживает экспорт', async () => {
        const report = await applyExportPlan(createPlan(), { ...createFigma().figma, variables: undefined } as never);
        expect(report.failure).toBe('Редактор не поддерживает переменные Figma.');
    });

    it('пропускает текстовый стиль без шрифта, а переменные создаёт', async () => {
        const { figma, variables, textStyles } = createFigma({ families: ['Inter'] });

        const report = await applyExportPlan(createPlan(), figma);

        expect(textStyles).toHaveLength(0);
        expect(variables).toHaveLength(4);
        expect(report.skipped).toEqual([
            { name: 'Header/H1 B', reason: 'шрифт SB Sans Display с насыщенностью 600 не найден в Figma' },
        ]);
        expect(report.missingFonts).toEqual(['SB Sans Display']);
    });

    it('не называет шрифт недостающим, если в семействе нет только нужного начертания', async () => {
        const { figma } = createFigma();
        const plan = createPlan();
        plan.textStyles[0].fontWeight = 900;

        const report = await applyExportPlan(plan, figma);

        expect(report.missingFonts).toEqual([]);
        expect(report.skipped).toEqual([
            { name: 'Header/H1 B', reason: 'шрифт SB Sans Display с насыщенностью 900 не найден в Figma' },
        ]);
    });

    it('пропускает ссылку на переменную, которой нет', async () => {
        const { figma } = createFigma();
        const plan = createPlan();
        plan.collections = plan.collections.slice(1, 2);

        const report = await applyExportPlan(plan, figma);

        expect(report.skipped.map((item) => item.reason)).toEqual([
            'нет переменной для ссылки в режиме light',
            'нет переменной для ссылки в режиме dark',
        ]);
    });
});

describe('матрица градиента', () => {
    it('переводит углы CSS в направление Figma', () => {
        const point = (angle: number, x: number, y: number) => {
            const [[a, b, c]] = gradientTransform(angle);
            return Math.round((a * x + b * y + c) * 1000) / 1000 + 0;
        };
        // 90° — слева направо, 180° — сверху вниз, 45° — из левого нижнего угла в правый верхний.
        expect([point(90, 0, 0.5), point(90, 1, 0.5)]).toEqual([0, 1]);
        expect([point(180, 0.5, 0), point(180, 0.5, 1)]).toEqual([0, 1]);
        expect([point(45, 0, 1), point(45, 1, 0)]).toEqual([0, 1]);
    });
    it('привязывает сплошной слой и стопы градиента к переменным стопов', async () => {
        const { figma, variables, paintStyles } = createFigma();
        const plan = createPlan();
        const stop = (key: string, name: string, r: number) => ({
            key,
            name,
            type: 'COLOR' as const,
            scopes: [],
            values: {
                light: { kind: 'color' as const, ...color(r) },
                dark: { kind: 'color' as const, ...color(r / 2) },
            },
        });
        plan.collections[1].variables.push(
            stop('gradient-stop:t9:0', 'GradientStops/Accent/Fill 1', 1),
            stop('gradient-stop:t9:1:0', 'GradientStops/Accent/Stop 1', 0.2),
        );
        plan.paintStyles = [
            {
                key: 'gradient:t9',
                name: 'Surfaces/Default/Accent/Solid/AccentGradient',
                paints: [
                    { kind: 'solid', color: color(1, 0.5), key: 'gradient-stop:t9:0' },
                    {
                        kind: 'linear',
                        angle: 90,
                        stops: [
                            { position: 0, color: color(0.2), key: 'gradient-stop:t9:1:0' },
                            { position: 1, color: color(1), key: 'gradient-stop:t9:1:missing' },
                        ],
                    },
                ],
            },
        ];

        const report = await applyExportPlan(plan, figma);

        const id = (name: string) => variables.find((variable) => variable.name === name)!.id;
        const [linear, solid] = paintStyles[0].paints as Array<Record<string, unknown>>;
        expect(solid.boundVariables).toEqual({
            color: { type: 'VARIABLE_ALIAS', id: id('GradientStops/Accent/Fill 1') },
        });
        const stops = linear.gradientStops as Array<Record<string, unknown>>;
        expect(stops[0].boundVariables).toEqual({
            color: { type: 'VARIABLE_ALIAS', id: id('GradientStops/Accent/Stop 1') },
        });
        expect(stops[1].boundVariables).toBeUndefined();
        expect(solid.opacity).toBe(1);
        expect(report.notes).toEqual([
            ...plan.notes!,
            {
                name: 'Surfaces/Default/Accent/Solid/AccentGradient',
                reason: 'цвет слоя не привязан к переменной: переменной стопа нет',
            },
        ]);
    });

    it('отдаёт ссылки на файлы только недостающих семейств', async () => {
        const { figma } = createFigma({ families: ['Inter'] });
        const plan = createPlan();
        const file = { name: 'Display-Bold.otf', url: 'https://cdn.example/Display-Bold.otf', weight: 'bold' };
        plan.fontFiles = [
            { family: 'SB Sans Display', files: [file] },
            { family: 'Inter', files: [{ name: 'Inter.otf', url: 'https://cdn.example/Inter.otf' }] },
        ];

        const report = await applyExportPlan(plan, figma);

        expect(report.fontFiles).toEqual([{ family: 'SB Sans Display', files: [file] }]);
    });
    it('привязывает цвет слоя тени к переменной ShadowColors', async () => {
        const { figma, variables, effectStyles } = createFigma();
        const plan = createPlan();
        plan.collections[1].variables.push({
            key: 'shadow-color:s1:0',
            name: 'ShadowColors/Down/Soft/S/Layer 1',
            type: 'COLOR',
            scopes: ['EFFECT_COLOR'],
            values: {
                light: { kind: 'alias', key: 'palette:neutral:general.gray.950', opacity: 8 },
                dark: { kind: 'alias', key: 'palette:neutral:general.gray.950', opacity: 8 },
            },
        });
        plan.effectStyles[0].shadows = [
            { ...plan.effectStyles[0].shadows[0], colorKey: 'shadow-color:s1:0' },
            { ...plan.effectStyles[0].shadows[0], colorKey: 'shadow-color:missing' },
            plan.effectStyles[0].shadows[0],
        ];

        const report = await applyExportPlan(plan, figma);

        const id = variables.find((variable) => variable.name === 'ShadowColors/Down/Soft/S/Layer 1')!.id;
        const effects = effectStyles[0].effects as Array<Record<string, unknown>>;
        expect(effects[0].boundVariables).toEqual({ color: { type: 'VARIABLE_ALIAS', id } });
        expect(effects[1].boundVariables).toBeUndefined();
        expect(effects[2].boundVariables).toBeUndefined();
        expect(report.notes).toContainEqual({
            name: 'Shadows/Down/Soft/S',
            reason: 'цвет слоя тени не привязан к переменной: переменной нет',
        });
    });
    it('при повторном экспорте не перезаписывает совпадающие значения и загружает шрифт один раз', async () => {
        const { figma, variables } = createFigma();
        const plan = createPlan();
        plan.textStyles.push({ ...plan.textStyles[0], key: 'text-style:header.h2.bold', name: 'Header/H2 B' });
        await applyExportPlan(plan, figma);
        const writes = variables.map((variable) => vi.spyOn(variable, 'setValueForMode'));
        const load = vi.spyOn(figma, 'loadFontAsync');
        const changed = createPlan();
        changed.collections[0].variables[0].values.default = { kind: 'color', ...color(0.3) };
        changed.textStyles = plan.textStyles;

        await applyExportPlan(changed, figma);

        expect(writes.map((write) => write.mock.calls.length)).toEqual([1, 0, 0, 0]);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('сравнивает значения Figma с допуском для каналов цвета', () => {
        expect(same({ r: 0.1, g: 0.2, b: 0.3, a: 1 }, { r: 0.10000001, g: 0.2, b: 0.3, a: 1 })).toBe(true);
        expect(same({ r: 0.1, g: 0.2, b: 0.3, a: 1 }, { r: 0.11, g: 0.2, b: 0.3, a: 1 })).toBe(false);
        expect(same({ type: 'VARIABLE_ALIAS', id: 'a' }, { type: 'VARIABLE_ALIAS', id: 'b' })).toBe(false);
        expect(same(['GAP'], ['GAP'])).toBe(true);
    });
});
