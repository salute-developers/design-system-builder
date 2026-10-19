import { expect, test } from '@playwright/test';

test('renders assembled editor changes through the real cross-origin plugin without reloading the iframe', async ({
    page,
}) => {
    await page.goto('/compose-preview-smoke.html');

    const frameRoot = page.locator('[data-status]');
    await expect(frameRoot).toHaveAttribute('data-status', 'success');
    const iframe = page.getByTitle('Compose component preview');
    await iframe.evaluate((element) => element.setAttribute('data-smoke-instance', 'original'));

    await expect(page.getByLabel('label')).toHaveValue('label');
    await page.getByLabel('label').fill('Descriptor label');
    await page.getByLabel('value').fill('Descriptor value');
    await page.getByLabel('icon').selectOption('End');
    await page.getByLabel('spacing').selectOption('SpaceBetween');
    await page.getByLabel('hasFixedWidth').check();
    await page.getByLabel('enabled').uncheck();
    await page.getByLabel('loading').check();
    await expect(frameRoot).toHaveAttribute('data-status', 'success');
    await expect(iframe).toHaveAttribute('data-smoke-instance', 'original');

    const state = page.getByTestId('payload-state');
    await expect(state).toHaveAttribute('data-label', 'Descriptor label');
    await expect(state).toHaveAttribute('data-value', 'Descriptor value');
    await expect(state).toHaveAttribute('data-icon', 'End');
    await expect(state).toHaveAttribute('data-spacing', 'SpaceBetween');
    await expect(state).toHaveAttribute('data-fixed-width', 'true');
    await expect(state).toHaveAttribute('data-loading', 'true');
    await expect(state).toHaveAttribute('data-enabled', 'false');

    await page.getByRole('button', { name: 'Apply editor changes' }).click();
    await expect(frameRoot).toHaveAttribute('data-status', 'success');
    await expect(iframe).toHaveAttribute('data-smoke-instance', 'original');

    await expect(state).toHaveAttribute('data-background', '#E53935FF');
    await expect(state).toHaveAttribute('data-height', '52');
    await expect(state).toHaveAttribute('data-shape', '16');
    await expect(state).toHaveAttribute('data-pressed', 'color.pressed');
    await expect(state).toHaveAttribute('data-variation', 'comfortable');
    await expect(state).toHaveAttribute('data-label', 'Descriptor label');
    await expect(state).toHaveAttribute('data-loading', 'true');
    await expect(state).toHaveAttribute('data-enabled', 'false');
});
