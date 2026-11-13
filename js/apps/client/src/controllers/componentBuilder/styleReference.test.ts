import { describe, expect, it } from 'vitest';

import { buttonMeta, groupMeta } from '../../composePreview/nestedStyleFixture';
import {
    buildStyleReferenceValue,
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
