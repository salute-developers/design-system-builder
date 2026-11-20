import { test as base, expect } from './colors.ts';
import { PaletteApi, paletteGroup, paletteStep, green, blue } from '../helpers/palette.api.ts';
import { PalettePage } from '../pages/palette.page.ts';
import type { ThemePalette } from '../helpers/palette.api.ts';

type Fixtures = {
    paletteApi: PaletteApi;
    paletteData: ThemePalette;
    palette: PalettePage;
    paletteBaseline: ThemePalette;
    linkedColor: Readonly<{ greenHex: string; blueHex: string }>;
};

export const test = base.extend<Fixtures>({
    paletteApi: async ({ environment, systemsApi, initialTheme, setupSession }, use) => {
        await use(new PaletteApi(environment.gatewayBaseURL, systemsApi.projectId, initialTheme.id, setupSession));
    },
    paletteData: async ({ paletteApi }, use) => {
        await use(await test.step('Подготовить точные слоты PAL-BASE через API', () => paletteApi.prepare()));
    },
    palette: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new PalettePage(page, editorURL.replace(/\/colors$/u, '/palette'), pageReadiness));
    },
    paletteBaseline: async ({ paletteData, versionsApi }, use) => {
        await versionsApi.publish('0.1.0', 'QA palette baseline');
        expect(await versionsApi.changes()).toEqual([]);
        await use(paletteData);
    },
    linkedColor: async ({ colorData, tokenValues, paletteApi, paletteData, initialTheme }, use) => {
        const accent = paletteGroup(paletteData, 'accent');
        const greenHex = paletteStep(accent, green, 500).value;
        const blueHex = '#2468AC';
        // Отличительный цвет этой темы выявляет чтение общего шаблона вместо её палитры.
        await paletteApi.seedStep(accent.id, blue, 500, blueHex);
        const byId = new Map(colorData.family.map((token) => [token.id, token.name]));
        const values = await tokenValues.values(initialTheme.id, 'color,gradient');
        const inheritedLight = values.filter((value) => {
            const name = byId.get(value.tokenId);
            return (
                name &&
                (name.includes('.on-light.') ||
                    (name.includes('.default.') && value.mode === 'light') ||
                    (name.includes('.inverse.') && value.mode === 'dark'))
            );
        });
        expect(inheritedLight).toHaveLength(36);
        await tokenValues.seed(
            initialTheme.id,
            inheritedLight.map((current) => ({ current, value: '[additional.h130.500]' })),
        );
        await use({ greenHex, blueHex });
    },
});

export { expect };
