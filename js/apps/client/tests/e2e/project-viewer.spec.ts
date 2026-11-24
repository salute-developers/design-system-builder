import { test, expect } from '../fixtures/role-colors.ts';

test(
    'PLASMABLDR-T531: PROJ-UI-013 RBAC Project: Viewer',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T531' } },
    async ({ page, systems, createdSystem, initialTheme, colorData, viewerColors }) => {
        expect(colorData.accent.name, 'Подготовлен textAccent для независимого сценария').toBe('text.default.accent');
        const main = page.getByRole('main');
        await test.step('Viewer открывает проект и видит подготовленную ДС', async () => {
            await systems.openCatalog();
            await expect(main.getByRole('heading', { name: 'Дизайн-системы', exact: true })).toBeVisible();
            await expect(systems.card(createdSystem.name)).toBeVisible();
        });
        await test.step('Управление проектом и дизайн-системой недоступно', async () => {
            await expect(main.getByRole('link', { name: 'Настройки проекта', exact: true })).toHaveCount(0);
            await expect(systems.createLink).toHaveCount(0);
            await expect(main.getByRole('article').getByRole('button')).toHaveCount(0);
            await expect(
                main.getByRole('button', { name: /настройки|участник|архив|восстановить|удалить/iu }),
            ).toHaveCount(0);
            await expect(main.getByRole('link', { name: /участник|архив|восстановить|удалить/iu })).toHaveCount(0);
        });
        await test.step('Открыть ДС, тему и цветовой токен через UI', async () => {
            await systems.card(createdSystem.name).click();
            await systems.card(initialTheme.name).click();
            await page
                .getByRole('complementary', { name: 'DS Builder navigation', exact: true })
                .getByRole('button', { name: 'Цветовые токены', exact: true })
                .click();
            await viewerColors.selectAccent();
        });
        await test.step('Значения видны, изменение и выбор цвета недоступны', async () => {
            await expect(viewerColors.readOnly).toBeVisible();
            await expect(viewerColors.light).toHaveValue('171717');
            await expect(viewerColors.dark).toHaveValue('F5F5F5');
            await expect(viewerColors.light).toBeDisabled();
            await expect(viewerColors.dark).toBeDisabled();
            await expect(viewerColors.lightPicker).toBeDisabled();
            await expect(viewerColors.darkPicker).toBeDisabled();
            await expect(page.getByRole('button', { name: 'Создать токен', exact: true })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Удалить токен', exact: true })).toHaveCount(0);
        });
    },
);
