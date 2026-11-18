import type { IconCatalog } from '../domain/iconCatalog';

export const catalogFixture: IconCatalog = {
    source: { package: '@salutejs/sdds-icons', version: '0.14.0', loadedAt: '2026-11-10T10:00:00Z', loadId: '3fa9c01d27be' },
    assetsBaseUrl: 'https://plugins.test/icons/3fa9c01d27be',
    icons: [
        {
            name: 'AddOutline',
            style: 'outline',
            sizes: [16, 24],
            legacyKey: 'add.outline',
            category: 'Actions & Feedback',
            aliases: ['добавить', 'plus'],
        },
        {
            name: 'DisclosureDownFill',
            style: 'fill',
            sizes: [16, 24, 36],
            legacyKey: 'disclosure.down.fill',
            category: 'Navigation & Movement',
            aliases: ['стрелка'],
        },
        {
            name: 'ArrowRight',
            style: 'none',
            sizes: [24],
            legacyKey: 'arrow.right',
            category: null,
            aliases: [],
        },
    ],
};
