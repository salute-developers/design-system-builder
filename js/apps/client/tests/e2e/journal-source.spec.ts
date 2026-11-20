import { test, expect } from '../fixtures/colors.ts';

test(
    'PLASMABLDR-T791: VER-UI-001 Журнал и точный переход к источнику',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T791' } },
    async ({ page, colors, changedColor, journal, createdSystem, initialTheme, editorURL }) => {
        await journal.open();
        await expect(colors.breadcrumb.getByText(createdSystem.name, { exact: true })).toBeVisible();
        await expect(colors.breadcrumb.getByText(initialTheme.name, { exact: true })).toBeVisible();
        const filters = page.getByRole('complementary', { name: 'Фильтры журнала', exact: true });
        for (const section of [
            'Все изменения',
            'Темы',
            'Палитра',
            'Цветовые токены',
            'Типографика',
            'Отступы, радиусы и тени',
            'Компоненты',
        ]) {
            await expect(
                filters.getByRole('button', { name: new RegExp('^' + section + '(?: \\d+)?$', 'u') }),
            ).toBeVisible();
        }
        await expect(journal.list.getByRole('article')).toHaveCount(1);
        const entry = journal.list.getByRole('button', {
            name: 'Цвет: textAccent Цвет · Светлый режим · Web',
            exact: true,
        });
        await entry.click();
        const details = page.getByRole('complementary', { name: 'Подробности изменения', exact: true });
        await expect(details.getByText('Цвет: textAccent', { exact: true })).toBeVisible();
        await expect(details.getByText('Цветовые токены', { exact: true })).toBeVisible();
        await expect(details.getByText('#171717', { exact: true })).toBeVisible();
        await expect(details.getByText('#3366CC', { exact: true })).toBeVisible();
        await details.getByRole('button', { name: 'Перейти к источнику', exact: true }).click();
        const sourceURL = new URL(editorURL);
        sourceURL.searchParams.set('tokenId', changedColor.accent.id);
        await expect(page).toHaveURL(sourceURL.href);
        await expect(colors.token('textAccent')).toHaveClass(/\bis-selected\b/u);
        await expect(colors.token('textPromoMinor')).not.toHaveClass(/\bis-selected\b/u);
        await expect(colors.tokenName).toHaveText('textAccent');
        await expect(colors.light).toHaveValue('3366CC');
        await journal.navigationButton.click();
        await expect(journal.list).toBeVisible();
        await colors.breadcrumb.getByRole('link', { name: initialTheme.name, exact: true }).click();
        await expect(page).toHaveURL(editorURL);
        await expect(colors.breadcrumb.getByText(createdSystem.name, { exact: true })).toBeVisible();
        await expect(colors.breadcrumb.getByText(initialTheme.name, { exact: true })).toBeVisible();
        await expect(colors.tokenName).toHaveText('textAccent');
        await expect(colors.light).toHaveValue('3366CC');
    },
);
