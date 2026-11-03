import { describe, expect, it } from 'vitest';

import { sectionStatus } from './useDesignSystem';

describe('sectionStatus', () => {
    it('загружает раздел компонентов целиком при первом входе', () => {
        expect(
            sectionStatus({ selected: true, componentSection: true, sectionReady: false, areaLoaded: false }),
        ).toEqual({ sectionLoading: true, sectionError: undefined, componentLoading: false, componentError: undefined });
    });

    it('при смене компонента в загруженном разделе грузит только компонент', () => {
        expect(
            sectionStatus({ selected: true, componentSection: true, sectionReady: false, areaLoaded: true }),
        ).toEqual({ sectionLoading: false, sectionError: undefined, componentLoading: true, componentError: undefined });
    });

    it('ошибку компонента в загруженном разделе отдаёт отдельно от ошибки раздела', () => {
        expect(
            sectionStatus({
                selected: true,
                componentSection: true,
                sectionReady: true,
                error: 'сбой',
                areaLoaded: true,
            }),
        ).toEqual({ sectionLoading: false, sectionError: undefined, componentLoading: false, componentError: 'сбой' });
    });

    it('ошибка первого входа в раздел компонентов остаётся ошибкой раздела', () => {
        expect(
            sectionStatus({
                selected: true,
                componentSection: true,
                sectionReady: true,
                error: 'сбой',
                areaLoaded: false,
            }),
        ).toMatchObject({ sectionError: 'сбой', componentError: undefined });
    });

    it('в остальных разделах ведёт себя как раньше', () => {
        expect(
            sectionStatus({ selected: true, componentSection: false, sectionReady: false, areaLoaded: true }),
        ).toEqual({ sectionLoading: true, sectionError: undefined, componentLoading: false, componentError: undefined });
        expect(
            sectionStatus({
                selected: true,
                componentSection: false,
                sectionReady: true,
                error: 'сбой',
                areaLoaded: true,
            }),
        ).toMatchObject({ sectionError: 'сбой', componentError: undefined });
    });
});
