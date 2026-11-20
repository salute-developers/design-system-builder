import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { saveMutation } from '../helpers/save-mutation.ts';
import type { PendingMutation } from '../helpers/pending-mutation.ts';
import type { SizesPage } from '../pages/sizes.page.ts';
import type { TypographyPage } from '../pages/typography.page.ts';

export async function commitField(field: Locator, value: string): Promise<void> {
    await field.fill(value);
    await field.press('Tab');
}

export async function saveSize(
    sizes: SizesPage,
    guard: PendingMutation,
    url: string,
    action: () => Promise<unknown>,
): Promise<void> {
    await saveMutation(guard, url, 'PUT', action);
    await expect(sizes.saveStatus).toHaveText('Сохранено');
}

export async function saveTypography(
    typography: TypographyPage,
    guard: PendingMutation,
    url: string,
    action: () => Promise<unknown>,
): Promise<void> {
    await saveMutation(guard, url, 'PATCH', action);
    await expect(typography.saved).toBeVisible();
}

/** Наблюдение реальных запросов: без подмены и повторов, удаляется через stop в finally. */
export function observeWrites(page: Page, url: string) {
    const scope = new URL(url);
    const writes: string[] = [];
    const observe = (request: Request) => {
        const actual = new URL(request.url());
        if (
            actual.origin === scope.origin &&
            (actual.pathname === scope.pathname || actual.pathname.startsWith(scope.pathname + '/')) &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
        ) {
            writes.push(request.method() + ' ' + actual.pathname);
        }
    };
    page.on('request', observe);
    return { writes, stop: () => page.off('request', observe) };
}
