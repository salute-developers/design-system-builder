import { describe, expect, it } from 'vitest';

import { buttonMeta, groupMeta } from '../../composePreview/nestedStyleFixture';
import type { Meta } from './type';
import {
    buildStyleReferenceValue,
    collectStyleReferenceValues,
    findUnloadedStyleReferenceTarget,
    listStyleReferenceTargets,
    parseStyleReference,
    resolveStyleReference,
    styleReferenceErrorMessage,
    toStyleReferenceInput,
} from './styleReference';

describe('resolveStyleReference', () => {
    const components = [groupMeta(), buttonMeta()];

    it('selects the styles named by the reference in the target configuration', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs.default');

        expect(resolved?.config.getName()).toBe('BasicButton');
        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('falls back to the default style of a variation the reference does not name', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs');

        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('finds a style name that is not in its positional variation', () => {
        const resolved = resolveStyleReference(components, 'basic-button.default.xxs');

        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('returns nothing for a configuration that does not exist', () => {
        expect(resolveStyleReference(components, 'missing.xxs')).toBeUndefined();
    });
});

describe('сборка ссылки на стиль', () => {
    const components = [groupMeta(), buttonMeta()];

    it('собирает строку в порядке вариаций оформления', () => {
        const resolved = resolveStyleReference(components, 'basic-button.default.xxs')!;

        expect(buildStyleReferenceValue(resolved.config, resolved.selections)).toBe('basic-button.xxs.default');
    });

    it('пропускает вариацию без выбранного стиля', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs')!;

        expect(buildStyleReferenceValue(resolved.config, { size: 'size-xxs' })).toBe('basic-button.xxs');
    });

    it('разбирает строку на оформление и стили', () => {
        expect(parseStyleReference('basic-button.xxs.default')).toEqual({
            appearanceName: 'basic-button',
            styleNames: ['xxs', 'default'],
        });
    });

    it('собирает выбор для операции записи: стили в порядке вариаций', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs.default')!;
        const input = toStyleReferenceInput(resolved);

        expect(input?.targetAppearanceId).toBe(resolved.config.getConfigurationId());
        expect(input?.styleIds).toEqual(['size-xxs', 'view-default']);
    });
});

describe('цели ссылки на стиль', () => {
    it('исключает собственное оформление и берёт имена из индекса для не загруженных компонентов', () => {
        const button = buttonMeta();
        const own = button.sources.configs[0].id;
        const indexOnly = {
            name: 'Chip',
            description: '',
            platform: 'compose',
            serverBinding: { componentId: 'chip', appearanceId: '', appearanceNames: ['chip-default'] },
            sources: { api: [], variations: [], configs: [] },
        } as never;

        const targets = listStyleReferenceTargets([button, indexOnly], own);

        expect(targets.find((item) => item.appearanceId === own)).toBeUndefined();
        expect(targets.find((item) => item.componentName === 'Chip')).toEqual({
            componentName: 'Chip',
            appearanceName: 'chip-default',
            loaded: false,
        });
    });
});

describe('цели с одинаковым именем оформления', () => {
    it('предлагает только первое одноимённое оформление, как его разворачивает ссылка', () => {
        const first = buttonMeta();
        const second = { ...buttonMeta(), name: 'OtherButton' };
        second.sources = {
            ...second.sources,
            configs: [{ ...second.sources.configs[0], id: 'other-config' }],
        };

        const targets = listStyleReferenceTargets([first, second]);

        expect(targets.map((item) => item.componentName)).toEqual(['BasicButton']);
    });
});

describe('цель с именем собственного оформления', () => {
    it('скрывает одноимённую цель другого компонента', () => {
        const own = groupMeta();
        const homonym = buttonMeta();
        homonym.sources.configs[0] = { ...homonym.sources.configs[0], name: own.sources.configs[0].name };

        const targets = listStyleReferenceTargets([own, homonym], own.sources.configs[0].id);

        expect(targets).toEqual([]);
    });
});

describe('сообщения об отказе проверки ссылки', () => {
    it('знает коды отказа и не знает прочие', () => {
        expect(styleReferenceErrorMessage('reference_cycle')).toContain('цикл');
        expect(styleReferenceErrorMessage('reference_too_deep')).toBeTruthy();
        expect(styleReferenceErrorMessage('other')).toBeUndefined();
    });
});

describe('collectStyleReferenceValues', () => {
    const group = groupMeta();
    const config = group.sources.configs[0].config;

    it('собирает значения component_style у стилей вариаций, инвариантов и сочетаний без повторов', () => {
        const withMore = structuredClone(config);
        withMore.invariantProps.push({ id: 'buttonStyle', value: 'chip.s' });
        withMore.combinations = [{ styleIDs: ['group-xxs'], props: [{ id: 'buttonStyle', value: 'tag.m' }] }];

        const values = collectStyleReferenceValues(withMore, group.sources.api);

        expect(values).toEqual(expect.arrayContaining(['basic-button.xxs.default', 'chip.s', 'tag.m']));
        expect(new Set(values).size).toBe(values.length);
    });

    it('собирает ссылки состояний инвариантов, стилей и пересечений для догрузки после reload', () => {
        const withStates = structuredClone(config);
        withStates.invariantProps.push({ id: 'buttonStyle', states: [{ state: ['pressed'], value: 'chip.s' }] });
        withStates.variations[0].styles![0].props![0].states = [{ state: ['focused'], value: 'tag.m' }];
        withStates.combinations = [
            {
                styleIDs: ['group-xxs', 'gap-wide'],
                props: [
                    {
                        id: 'buttonStyle',
                        states: [{ state: ['hovered'], value: 'tag.l' }, { state: ['pressed'] }],
                    },
                ],
            },
        ];
        expect(collectStyleReferenceValues(withStates, group.sources.api)).toEqual([
            'chip.s',
            'basic-button.xxs.default',
            'tag.m',
            'tag.l',
        ]);
    });

    it('пропускает другие типы свойств и пустые значения', () => {
        const other = structuredClone(config);
        other.invariantProps.push({ id: 'spacing', value: '8' }, { id: 'buttonStyle', value: '' });

        expect(collectStyleReferenceValues(other, group.sources.api)).not.toContain('8');
        expect(collectStyleReferenceValues(other, group.sources.api)).not.toContain('');
    });

    it('без свойств component_style в API ничего не собирает', () => {
        expect(collectStyleReferenceValues(config, [])).toEqual([]);
    });
});

describe('findUnloadedStyleReferenceTarget', () => {
    const unloaded = (): Meta => ({
        ...structuredClone(buttonMeta()),
        name: 'Chip',
        sources: { api: [], variations: [], configs: [] },
        serverBinding: { componentId: 'chip', appearanceId: '', appearanceNames: ['chip'] },
    });

    it('называет компонент оформления, чьи конфигурации не загружены', () => {
        expect(findUnloadedStyleReferenceTarget([groupMeta(), unloaded()], 'chip.s.default')).toBe('Chip');
    });

    it('возвращает undefined, если ссылка уже разворачивается или оформление неизвестно', () => {
        expect(
            findUnloadedStyleReferenceTarget([groupMeta(), buttonMeta()], 'basic-button.xxs.default'),
        ).toBeUndefined();
        expect(findUnloadedStyleReferenceTarget([groupMeta(), unloaded()], 'nothing.s')).toBeUndefined();
    });
});
