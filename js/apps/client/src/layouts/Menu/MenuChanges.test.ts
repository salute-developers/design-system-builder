import { describe, expect, it } from 'vitest';
import type { Token } from '../../controllers';
import { isTokenChanged as currentMenuChanged } from './Menu.utils';
import { isTokenChanged as legacyMenuChanged } from './MenuOld.utils';

const token = (changedPlatform?: string) =>
    ({
        getName: () => 'shadow.default.small',
        getPlatforms: () => ({ web: {}, ios: {}, android: {} }),
        getDefaultValue: () => 1,
        getValue: (platform: string) => (platform === changedPlatform ? 2 : 1),
        getDescription: () => '',
        getDefaultDescription: () => '',
    }) as unknown as Token;

for (const [name, changed] of [
    ['current', currentMenuChanged],
    ['legacy', legacyMenuChanged],
] as const) {
    describe(`${name} token change indicator`, () => {
        it('checks every platform, including changes outside web', () => {
            expect(changed([token('ios')])).toBe(true);
            expect(changed([token('android')])).toBe(true);
            expect(changed([token()])).toBe(false);
        });
    });
}
