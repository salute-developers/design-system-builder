import { test, expect } from '../fixtures/palette.ts';

test(
    'PLASMABLDR-T782: CT-024 Палитровая ссылка и прямой HEX',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T782' } },
    async ({ page, colors, colorSteps, linkedColor, initialTheme, tokenValues, colorData, editorURL }) => {
        await colors.open();
        await colors.token('textAccent').click();
        const valuesURL = tokenValues.colorURL(initialTheme.id, colorData.accent.id);
        await test.step('Исходный Light связан с Accent Green/Hue130 #500', async () => {
            await expect(colors.light).toHaveValue('Green 500');
            await expect(colors.light).toHaveAttribute('readonly', '');
            await expect(colors.lightSwatch).toHaveCSS('--swatch-color', linkedColor.greenHex);
            await colors.openLight();
            await expect(colors.libraryTab).toHaveAttribute('aria-pressed', 'true');
            await expect(colors.libraryStep('Green', 500, linkedColor.greenHex)).toHaveClass(/\bis-active\b/u);
            await colors.closePicker();
        });

        await test.step('Заменить ссылку прямым HEX и проверить после reload', async () => {
            await colorSteps.saveLight('#3366CC', valuesURL);
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('3366CC');
            await expect(colors.light).not.toHaveAttribute('readonly', '');
            await colors.openLight();
            await expect(colors.manualTab).toHaveAttribute('aria-pressed', 'true');
            await expect(colors.hex).toHaveValue('3366CC');
            await colors.libraryTab.click();
            await expect(colors.picker.locator('.cp-preset.is-active')).toHaveCount(0);
        });

        await test.step('Выбрать Blue #500 именно текущей темы и подтвердить сохранение', async () => {
            await expect(page).toHaveURL(editorURL);
            await expect(colors.breadcrumb.getByText(initialTheme.name, { exact: true })).toBeVisible();
            const blue = colors.libraryStep('Blue', 500, linkedColor.blueHex);
            await expect(blue).toBeVisible();
            await expect(blue).toHaveCSS('background-color', 'rgb(36, 104, 172)');
            await colorSteps.selectLibraryStep('Blue', 500, linkedColor.blueHex, valuesURL);
            await expect(colors.light).toHaveAttribute('readonly', '');
            await expect(colors.lightSwatch).toHaveCSS('--swatch-color', linkedColor.blueHex);
        });

        await test.step('После reload сохранена ссылка Blue, а не отдельный HEX', async () => {
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(page).toHaveURL(editorURL);
            await expect(colors.light).toHaveValue('Blue 500');
            await expect(colors.lightSwatch).toHaveCSS('--swatch-color', linkedColor.blueHex);
            await colors.openLight();
            await expect(colors.libraryTab).toHaveAttribute('aria-pressed', 'true');
            await expect(colors.libraryStep('Blue', 500, linkedColor.blueHex)).toHaveClass(/\bis-active\b/u);
            await expect(colors.libraryStep('Green', 500, linkedColor.greenHex)).not.toHaveClass(/\bis-active\b/u);
            await colors.closePicker();
        });
    },
);
