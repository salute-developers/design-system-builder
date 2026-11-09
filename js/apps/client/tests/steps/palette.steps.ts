import { expect } from '@playwright/test';
import type { Locator } from '@playwright/test';
import type { PendingMutation } from '../helpers/pending-mutation.ts';
import type { PalettePage } from '../pages/palette.page.ts';

export function cssColor(hex: string): string {
    return 'rgb(' + [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ') + ')';
}

export async function applyPaletteStep(
    palette: PalettePage,
    target: Locator,
    pendingMutation: PendingMutation,
    stepURL: string,
    hex: string,
): Promise<void> {
    const endpoint = new URL(stepURL);
    const started = performance.now();
    const remaining = () => Math.max(1, 10_000 - (performance.now() - started));
    const response = await pendingMutation.run(
        (response) => {
            const actual = new URL(response.url());
            return (
                response.request().method() === 'PATCH' &&
                actual.origin === endpoint.origin &&
                actual.pathname === endpoint.pathname
            );
        },
        () => palette.applyButton.click(),
        'Изменение ступени палитры',
        10_000,
    );
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ value: hex });
    await expect(palette.dialog).toBeHidden({ timeout: remaining() });
    await expect(target).toHaveCSS('background-color', cssColor(hex), { timeout: remaining() });
    expect(performance.now() - started, 'Ответ и обновлённая ступень не дольше 10 секунд').toBeLessThanOrEqual(10_000);
}
