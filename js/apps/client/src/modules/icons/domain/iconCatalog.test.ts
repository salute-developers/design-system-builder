import { describe, expect, it } from 'vitest';

import { catalogFixture as catalog } from '../__fixtures__/catalog';
import { categoriesOf, filterIcons, fromLegacyValue, iconAssetUrl, iconPreviewAsset, toLegacyValue } from './iconCatalog';

const base = { query: '', category: null, style: 'all', size: 24 } as const;
const names = (filter: Partial<Parameters<typeof filterIcons>[1]>) =>
    filterIcons(catalog, { ...base, ...filter }).map((icon) => icon.name);

describe('filterIcons', () => {
    it('finds by name substring regardless of case', () => {
        expect(names({ query: 'ARROW' })).toEqual(['ArrowRight']);
    });

    it('finds by a Russian synonym', () => {
        expect(names({ query: 'добавить' })).toEqual(['AddOutline']);
    });

    it('filters by category, style and size', () => {
        expect(names({ category: 'Navigation & Movement' })).toEqual(['DisclosureDownFill']);
        expect(names({ style: 'fill' })).toEqual(['DisclosureDownFill']);
        expect(names({ size: 36 })).toEqual(['DisclosureDownFill']);
    });

    it('filters by the outline-bold style as the backend names it', () => {
        const bold = {
            ...catalog.icons[0],
            name: 'AddOutlineBold',
            style: 'outline-bold',
            legacyKey: 'add.outline.bold',
        } as const;
        const withBold = { ...catalog, icons: [...catalog.icons, bold] };
        expect(filterIcons(withBold, { ...base, style: 'outline-bold' }).map((icon) => icon.name)).toEqual([
            'AddOutlineBold',
        ]);
    });

    it('hides icons without the selected size', () => {
        expect(names({ size: 16 })).toEqual(['AddOutline', 'DisclosureDownFill']);
    });

    it('returns nothing for an unknown query', () => {
        expect(names({ query: 'zzz' })).toEqual([]);
    });
});

describe('categoriesOf', () => {
    it('counts icons and skips icons without a category', () => {
        expect(categoriesOf(catalog)).toEqual([
            { name: 'Actions & Feedback', count: 1 },
            { name: 'Navigation & Movement', count: 1 },
        ]);
    });
});

describe('legacy values', () => {
    it('builds the legacy-format string', () => {
        expect(toLegacyValue(catalog.icons[1], 16)).toBe('disclosure.down.fill.16');
    });

    it('resolves a value to the icon and size', () => {
        expect(fromLegacyValue('disclosure.down.fill.16', catalog)).toEqual({ icon: catalog.icons[1], size: 16 });
    });

    it('resolves a value without a style to the outline icon', () => {
        // `add.24` — значение без начертания, в каталоге это `AddOutline` (ключ `add.outline`).
        expect(fromLegacyValue('add.24', catalog)).toEqual({ icon: catalog.icons[0], size: 24 });
        expect(fromLegacyValue('add.36', catalog)).toBeUndefined();
    });

    it('does not resolve unknown keys, missing sizes or malformed values', () => {
        expect(fromLegacyValue('chevron.left.24', catalog)).toBeUndefined();
        expect(fromLegacyValue('add.outline.36', catalog)).toBeUndefined();
        expect(fromLegacyValue('add.outline', catalog)).toBeUndefined();
        expect(fromLegacyValue('', catalog)).toBeUndefined();
        expect(fromLegacyValue(undefined, catalog)).toBeUndefined();
    });
});

describe('iconAssetUrl', () => {
    it('joins base URL, size and name', () => {
        expect(iconAssetUrl(catalog, 'AddOutline', 24)).toBe(
            'https://plugins.test/icons/3fa9c01d27be/24/AddOutline.svg',
        );
    });
});

describe('iconPreviewAsset', () => {
    it('resolves a legacy value to the SVG file of the catalog', () => {
        expect(iconPreviewAsset(catalog, 'disclosure.down.fill.16')).toEqual({
            id: 'disclosure.down.fill.16',
            type: 'SVG',
            url: 'https://plugins.test/icons/3fa9c01d27be/16/DisclosureDownFill.svg',
        });
    });

    it('returns nothing for a value outside the catalog or without a catalog', () => {
        expect(iconPreviewAsset(catalog, 'no.such.icon.16')).toBeUndefined();
        expect(iconPreviewAsset(undefined, 'disclosure.down.fill.16')).toBeUndefined();
    });
});
