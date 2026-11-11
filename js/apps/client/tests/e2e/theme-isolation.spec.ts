import { expect, test } from '../fixtures/theme-isolation.ts';

test(
    'PLASMABLDR-T560: PROJ-UI-042 Theme isolation: сохранённые values не смешиваются между A и B',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T560' } },
    async ({ page, colors, colorSteps, twoThemes, colorData, tokenValues, createdSystem, systems }) => {
        const { first, second } = twoThemes;
        const editorURL = (themeId: string) =>
            systems.systemURL(createdSystem.id) + '/themes/' + encodeURIComponent(themeId) + '/colors';
        await colors.open();
        await test.step('Сохранить красный Light textAccent в Theme A', async () => {
            await expect(page).toHaveURL(editorURL(first.id));
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('171717');
            await expect(colors.dark).toHaveValue('F5F5F5');
            await colorSteps.saveLight('#FF0000', tokenValues.colorURL(first.id, colorData.accent.id));
        });

        await test.step('Перейти в Theme B через UI и сохранить синий Light', async () => {
            await colors.switchTheme(createdSystem.name, second.name);
            await expect(page).toHaveURL(editorURL(second.id));
            await colors.token('textAccent').click();
            await expect(colors.light, 'Запись A не изменила исходный цвет B').toHaveValue('171717');
            await expect(colors.dark).toHaveValue('F5F5F5');
            await colorSteps.saveLight('#0000FF', tokenValues.colorURL(second.id, colorData.accent.id));
        });

        await test.step('После reload повторно открыть A и B: значения независимы', async () => {
            await colors.reload();
            for (const [theme, hex] of [
                [first, 'FF0000'],
                [second, '0000FF'],
            ] as const) {
                await colors.switchTheme(createdSystem.name, theme.name);
                await expect(page).toHaveURL(editorURL(theme.id));
                await expect(colors.breadcrumb.getByText(theme.name, { exact: true })).toBeVisible();
                await colors.token('textAccent').click();
                await expect(colors.light).toHaveValue(hex);
                await expect(colors.dark).toHaveValue('F5F5F5');
            }
        });
    },
);
