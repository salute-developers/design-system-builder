import { describe, expect, it } from 'vitest';

import golden from '../fixtures/palette-golden.json';
import {
    buildThemePalette,
    createPaletteState,
    defaultGroupForToken,
    formatPaletteReference,
    parsePaletteReference,
    paletteOperations,
    PaletteOperationError,
    rampDisplayName,
    rampKey,
    rebuildRamp,
    resolvePaletteStep,
    swatchLabelColor,
    withOpacity,
    type PaletteRampRef,
    type PaletteState,
    type PaletteTokenRef,
    type PaletteTokenValue,
} from '.';

const scenarioState = () => JSON.parse(JSON.stringify(golden.scenario.state)) as PaletteState;
const tokens = golden.scenario.tokens as PaletteTokenRef[];
const values = golden.scenario.values as PaletteTokenValue[];
const build = (state = scenarioState(), extraValues: PaletteTokenValue[] = []) =>
    buildThemePalette({ tenantId: 'tenant', canEdit: true, state, tokens, values: [...values, ...extraValues] });
const ctx = (state: PaletteState) => {
    const model = build(state);
    let counter = 0;
    return { palette: model.palette, links: model.links, newId: () => `new-${++counter}` };
};
const ref = (key: string): PaletteRampRef => {
    const [type, shade] = key.split('.');
    return { type: type as PaletteRampRef['type'], shade };
};

describe('эталон palette-golden.json', () => {
    it('группа по умолчанию', () => {
        for (const item of golden.defaultGroups) expect(defaultGroupForToken(item.tokenName)).toBe(item.group);
    });

    it('отображаемые имена', () => {
        for (const item of golden.displayNames)
            expect(rampDisplayName(item.source as PaletteRampRef, item.anchor)).toBe(item.expected);
    });

    it('перестройка совпадает с прототипом', () => {
        for (const item of golden.rebuild) {
            const source = (golden.template as Record<string, Record<string, string>>)[item.source];
            expect(rebuildRamp(source, item.anchorStep, item.value)).toEqual(item.expected);
        }
    });

    it('состав групп, значения ступеней и связи', () => {
        const { palette } = build();
        const expected = golden.scenario.expected;
        expect(palette.offBrand).toBe(expected.offBrand);
        expect(palette.editRevision).toBe(7);
        expect(palette.tokens.map(({ tokenId, groupId, assignment }) => ({ tokenId, groupId, assignment }))).toEqual(
            expected.tokens,
        );
        expect(palette.groups.map((group) => group.id)).toEqual(Object.keys(expected.groups));
        for (const group of palette.groups) {
            const groupExpected = expected.groups[group.id as keyof typeof expected.groups];
            expect(group.ramps.map((ramp) => rampKey(ramp.slot))).toEqual(groupExpected.map((ramp) => ramp.slot));
            group.ramps.forEach((ramp, index) => {
                const rampExpected = groupExpected[index];
                expect(rampKey(ramp.source)).toBe(rampExpected.source);
                expect(ramp.displayName).toBe(rampExpected.displayName);
                expect(ramp.linkedCount).toBe(rampExpected.linkedCount);
                expect(ramp.modified).toBe(rampExpected.modified);
                for (const [step, stepExpected] of Object.entries(rampExpected.steps)) {
                    const actual = ramp.steps.find((item) => item.step === Number(step))!;
                    expect(actual).toMatchObject(stepExpected);
                }
            });
        }
    });

    it('слот, которого нет в группе токена, берётся из копии шаблона', () => {
        const { palette } = build();
        expect(resolvePaletteStep(palette, '[additional.h190.300]', 'text.default.primary')).toEqual({
            hex: golden.template['additional.h190']['300'],
            opacity: null,
        });
        expect(resolvePaletteStep(palette, '[general.red.500]', 'text.default.primary')).toBeUndefined();
    });

    it('разрешение ссылок по группе токена', () => {
        const { palette } = build();
        for (const item of golden.scenario.expected.resolve)
            expect(resolvePaletteStep(palette, item.value, item.tokenName)).toEqual({
                hex: item.hex,
                opacity: item.opacity,
            });
    });
});

describe('ссылки и цвета', () => {
    it('разбирает обе формы значения и форматирует обратно', () => {
        expect(parsePaletteReference('[general.amber.300][0.56]')).toEqual({
            type: 'general',
            shade: 'amber',
            step: 300,
            opacity: 0.56,
        });
        expect(parsePaletteReference(['[additional.h190.500]'])).toMatchObject({ shade: 'h190', opacity: null });
        expect(parsePaletteReference('#FFFFFF')).toBeNull();
        expect(formatPaletteReference({ type: 'general', shade: 'red', step: 500, opacity: 0.4 })).toBe(
            '[general.red.500][0.4]',
        );
    });

    it('прозрачность — альфа-канал round(opacity * 255)', () => {
        expect(withOpacity('#0497B5', 0.8)).toBe('#0497B5CC');
        expect(withOpacity('#0497B5', 1)).toBe('#0497B5');
        expect(withOpacity('#0497B5', null)).toBe('#0497B5');
    });

    it('контрастная подпись свотча', () => {
        expect(swatchLabelColor('#FFFFFF')).toBe('#000000');
        expect(swatchLabelColor('#04090A')).toBe('#FFFFFF');
    });
});

describe('операции палитры', () => {
    it('новое состояние — копия шаблона с системными группами', () => {
        let id = 0;
        const template = { 'general.red': { '500': '#FF0000' } };
        const state = createPaletteState(template, () => `g${++id}`);
        template['general.red']['500'] = '#000000';
        expect(state.template['general.red']['500']).toBe('#FF0000');
        expect(state.groups.map((group) => group.systemKey)).toEqual(['neutral', 'accent', 'status', 'data', 'syntax']);
    });

    it('создание группы: пустое и повторное название', () => {
        const state = scenarioState();
        expect(() => paletteOperations.createGroup(state, '  ', ctx(state))).toThrow(PaletteOperationError);
        expect(() => paletteOperations.createGroup(state, 'avatars', ctx(state))).toThrow(
            expect.objectContaining({ code: 'PALETTE_GROUP_EXISTS' }),
        );
        const result = paletteOperations.createGroup(state, 'Icons', ctx(state));
        expect(result.value).toMatchObject({ kind: 'custom', systemKey: null, label: 'Icons' });
        expect(result.state.editRevision).toBe(8);
    });

    it('удаление группы возвращает токены к группе по умолчанию и переносит растяжки в neutral', () => {
        const state = scenarioState();
        expect(() => paletteOperations.deleteGroup(state, 'g-accent', ctx(state))).toThrow(
            expect.objectContaining({ code: 'PALETTE_GROUP_SYSTEM' }),
        );
        const next = paletteOperations.deleteGroup(state, 'g-avatars', ctx(state)).state;
        expect(next.tokenGroups).toEqual({});
        expect(next.ramps.find((ramp) => rampKey(ramp.slot) === 'additional.h130')?.groupId).toBe('g-neutral');
        const token = build(next).palette.tokens.find((item) => item.tokenId === 't3')!;
        expect(token).toMatchObject({ groupId: 'g-neutral', assignment: 'default' });
    });

    it('удаление группы не перекрывает слот, который есть в neutral только по связям токенов', () => {
        const state = scenarioState();
        // general.green в neutral известен только по связи t2; в Avatars тот же слот заменён на h190.
        state.ramps.push({
            groupId: 'g-avatars',
            slot: ref('general.green'),
            source: ref('additional.h190'),
            added: true,
            origin: 'template',
            anchor: null,
            steps: {},
        });
        const next = paletteOperations.deleteGroup(state, 'g-avatars', ctx(state)).state;
        expect(resolvePaletteStep(build(next).palette, '[general.green.500]', 'text.default.primary')!.hex).toBe(
            golden.template['general.green']['500'],
        );
    });

    it('у растяжки только ступени слота, даже если у источника их больше', () => {
        const state = scenarioState();
        // слот additional.h130 (14 ступеней) с источником general.green (15 ступеней, есть 50)
        state.ramps[1] = { ...state.ramps[1], source: ref('general.green'), steps: {} };
        const ramp = build(state).palette.groups.find((group) => group.id === 'g-avatars')!.ramps[0];
        expect(ramp.steps.map((step) => step.step)).not.toContain(50);
        expect(ramp.steps).toHaveLength(14);
    });

    it('токен, неизвестный палитре, разрешается по группе правила имени, без имени — по шаблону', () => {
        const { palette } = build();
        expect(resolvePaletteStep(palette, '[general.green.500]', 'surface.default.accent-new')!.hex).toBe(
            golden.template['additional.h190']['500'],
        );
        expect(resolvePaletteStep(palette, '[general.green.500]')!.hex).toBe(golden.template['general.green']['500']);
    });

    it('явная привязка и сброс', () => {
        const state = scenarioState();
        const assigned = paletteOperations.assignTokenGroup(state, 't2', 'g-avatars', ctx(state)).state;
        expect(build(assigned).palette.tokens.find((item) => item.tokenId === 't2')).toMatchObject({
            groupId: 'g-avatars',
            assignment: 'explicit',
        });
        const reset = paletteOperations.assignTokenGroup(assigned, 't2', null, ctx(assigned)).state;
        expect(build(reset).palette.tokens.find((item) => item.tokenId === 't2')!.assignment).toBe('default');
        expect(() => paletteOperations.assignTokenGroup(state, 'missing', null, ctx(state))).toThrow(
            expect.objectContaining({ status: 404 }),
        );
    });

    it('добавление растяжки и повтор', () => {
        const state = scenarioState();
        expect(() => paletteOperations.addRamp(state, 'g-accent', ref('general.green'), ctx(state))).toThrow(
            expect.objectContaining({ code: 'PALETTE_RAMP_EXISTS' }),
        );
        const next = paletteOperations.addRamp(state, 'g-status', ref('general.coolGray'), ctx(state)).state;
        const ramp = build(next).palette.groups.find((group) => group.id === 'g-status')!.ramps[0];
        expect(ramp).toMatchObject({ added: true, linkedCount: 0 });
        expect(rampKey(ramp.source)).toBe('general.coolGray');
    });

    it('замена источника только в группе и проверка ступеней', () => {
        const state = scenarioState();
        const next = paletteOperations.replaceSource(state, 'g-neutral', ref('general.green'), ref('general.coolGray'), ctx(state)).state;
        const palette = build(next).palette;
        expect(resolvePaletteStep(palette, '[general.green.500]', 'text.default.primary')!.hex).toBe(
            golden.template['general.coolGray']['500'],
        );
        expect(resolvePaletteStep(palette, '[general.green.500]', 'text.default.accent')!.hex).toBe(
            golden.template['additional.h190']['500'],
        );

        const withStep50 = [{ tokenId: 't2', mode: 'dark', platform: 'ios', value: '[general.green.50]' }];
        const model = build(scenarioState(), withStep50);
        expect(() =>
            paletteOperations.replaceSource(scenarioState(), 'g-neutral', ref('general.green'), ref('additional.h190'), {
                ...model,
                newId: () => 'x',
            }),
        ).toThrow(expect.objectContaining({ code: 'PALETTE_STEP_MISSING', details: { steps: [50] } }));
    });

    it('перестройка: превью без изменений и применение', () => {
        const state = scenarioState();
        const preview = paletteOperations.rebuildPreview(state, 'g-accent', ref('general.green'), 500, '#7B2FF7', ctx(state));
        expect(preview).toEqual(golden.rebuild[1].expected);
        const next = paletteOperations.rebuild(state, 'g-accent', ref('general.green'), 500, '#7b2ff7', ctx(state)).state;
        const ramp = build(next).palette.groups.find((group) => group.id === 'g-accent')!.ramps[0];
        expect(ramp).toMatchObject({ origin: 'rebuild', anchor: { step: 500, value: '#7B2FF7' }, modified: true });
        expect(() =>
            paletteOperations.rebuild(state, 'g-accent', ref('general.green'), 500, 'nope', ctx(state)),
        ).toThrow(expect.objectContaining({ status: 400 }));
    });

    it('правка ступени, в том числе опорной', () => {
        const state = scenarioState();
        const rebuilt = paletteOperations.rebuild(state, 'g-accent', ref('general.green'), 500, '#1F8A70', ctx(state)).state;
        const next = paletteOperations.updateStep(rebuilt, 'g-accent', ref('general.green'), 500, '#e8114d', ctx(rebuilt)).state;
        const ramp = build(next).palette.groups.find((group) => group.id === 'g-accent')!.ramps[0];
        expect(ramp.anchor).toEqual({ step: 500, value: '#E8114D' });
        expect(ramp.displayName).toBe('Coral');
        expect(() =>
            paletteOperations.updateStep(state, 'g-accent', ref('general.green'), 50, '#FFFFFF', ctx(state)),
        ).toThrow(expect.objectContaining({ status: 404 }));
    });

    it('удаление растяжки: без стратегии, с заменой и с отвязкой', () => {
        const state = scenarioState();
        expect(() => paletteOperations.removeRamp(state, 'g-accent', ref('general.green'), {}, ctx(state))).toThrow(
            expect.objectContaining({ code: 'PALETTE_RAMP_LINKED' }),
        );
        const replaced = paletteOperations.removeRamp(
            state,
            'g-accent',
            ref('general.green'),
            { strategy: 'replace', replacement: ref('additional.h130') },
            ctx(state),
        );
        expect(replaced.value.reassigned).toBe(2);
        expect(replaced.value.rewrite).toEqual({ tokenIds: ['t1'], from: ref('general.green'), to: ref('additional.h130') });
        expect(paletteOperations.rewriteTokenValue('[general.green.400][0.5]', replaced.value.rewrite!, () => undefined)).toBe(
            '[additional.h130.400][0.5]',
        );
        const detached = paletteOperations.removeRamp(state, 'g-accent', ref('general.green'), { strategy: 'detach' }, ctx(state));
        expect(
            paletteOperations.rewriteTokenValue('[general.green.400][0.5]', detached.value.rewrite!, () => '#08A5C4'),
        ).toBe('#08A5C480');
        expect(paletteOperations.rewriteTokenValue('[general.gray.400]', detached.value.rewrite!, () => '#000000')).toBeUndefined();
    });
});
