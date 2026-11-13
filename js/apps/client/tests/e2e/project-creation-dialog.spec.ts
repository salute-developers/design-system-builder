import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/projects.ts';

test(
    'PLASMABLDR-T521: PROJ-UI-003 Project: Name обязателен',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T521' } },
    async ({ projects, projectCreations }) => {
        await projects.openCreateDialog();
        await expect(projects.nextButton).toBeDisabled();
        await projects.nameInput.fill('QA Required Name');
        await expect(projects.nextButton).toBeEnabled();
        await projects.nameInput.press('ControlOrMeta+A');
        await projects.nameInput.press('Backspace');
        await projects.nameInput.press('Tab');
        await expect(projects.nameInput).toHaveValue('');
        await expect(projects.nextButton).toBeDisabled();
        expect(projectCreations(), 'Очистка валидного имени не отправляет POST').toBe(0);
        await projects.nameInput.fill('   ');
        await projects.nameInput.press('Tab');
        await expect(projects.nextButton).toBeDisabled();
        await projects.cancelLink.click();
        await expect(projects.dialog).toBeHidden();
        expect(projectCreations(), 'Пустое и пробельное имя не отправляют POST проекта').toBe(0);
    },
);

test(
    'PLASMABLDR-T523: PROJ-UI-005 Project: Cancel не создаёт Project',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T523' } },
    async ({ page, projects, projectCreations }) => {
        const name = 'e2e-cancel-' + randomUUID();
        await projects.openCreateDialog();
        await projects.nameInput.fill(name);
        await projects.descriptionInput.fill('Cancel check');
        await expect(projects.nextButton).toBeEnabled();
        await projects.cancelLink.click();
        await expect(projects.dialog).toBeHidden();
        await expect(page).toHaveURL(projects.catalogURL);
        await page.reload();
        await expect(projects.createLink).toBeVisible();
        await expect(projects.card(name)).toHaveCount(0);
        expect(projectCreations(), 'Cancel не отправляет POST проекта').toBe(0);
    },
);

test(
    'PLASMABLDR-T566: PROJ-UI-048 Create Project Team: Tab/Shift+Tab не выпускает focus из modal',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T566' } },
    async ({ page, projects, projectCreations }) => {
        await projects.openCreateDialog();
        await projects.nameInput.fill('e2e-focus-' + randomUUID());
        await projects.nextButton.click();
        await expect(projects.memberSearch).toBeFocused();
        for (const next of [projects.roleButton, projects.backButton, projects.submitButton, projects.memberSearch]) {
            await page.keyboard.press('Tab');
            await expect(next).toBeFocused();
        }
        await page.keyboard.press('Shift+Tab');
        await expect(projects.submitButton).toBeFocused();
        await projects.backButton.click();
        await projects.cancelLink.click();
        await expect(projects.dialog).toBeHidden();
        await expect(page).toHaveURL(projects.catalogURL);
        await expect(projects.createLink).toBeFocused();
        expect(projectCreations(), 'Проверка клавиатуры не создаёт проект').toBe(0);
    },
);
