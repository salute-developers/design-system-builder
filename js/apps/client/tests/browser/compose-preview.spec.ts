import { expect, test } from '@playwright/test';

test('renders two full Button payloads through the real cross-origin plugin without reloading the iframe', async ({
    page,
}) => {
    await page.goto('/compose-preview-smoke.html');

    const frameRoot = page.locator('[data-status]');
    await expect(frameRoot).toHaveAttribute('data-status', 'success');
    const iframe = page.getByTitle('Compose component preview');
    await iframe.evaluate((element) => element.setAttribute('data-smoke-instance', 'original'));

    await page.getByRole('button', { name: 'Send second full payload' }).click();
    await expect(frameRoot).toHaveAttribute('data-status', 'success');
    await expect(iframe).toHaveAttribute('data-smoke-instance', 'original');
});
