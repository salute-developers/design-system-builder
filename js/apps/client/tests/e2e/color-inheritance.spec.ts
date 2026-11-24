import { test, expect } from '../fixtures/colors.ts';
import { exactDefinition, exactValue } from '../helpers/color-data.ts';
import { saveMutation } from '../helpers/save-mutation.ts';

test.use({ viewport: { width: 1440, height: 900 } });
test.describe('Наследование цветов', () => {
    test(
        'PLASMABLDR-T783: CT-043 Наследование подтемы: отключение и восстановление',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T783' } },
        async ({ page, colors, colorData, colorSteps, tokenValues, initialTheme, pendingMutation }) => {
            const endpoint = tokenValues.colorURL(initialTheme.id, colorData.accent.id);
            const onlight = exactDefinition(colorData.family, 'text.on-light.accent');
            const before = await tokenValues.values(initialTheme.id, 'color');
            await colors.open();
            await colors.token('textAccent').click();
            const heading = colors.inspector
                .getByRole('heading')
                .filter({ has: page.getByText('OnLight', { exact: true }) });
            const light = heading
                .locator('xpath=following-sibling::div[1]')
                .getByRole('textbox', { name: 'Light', exact: true });
            const linked = heading.getByRole('button', { name: 'Связь с Modes включена', exact: true });
            await expect(linked).toHaveAttribute('aria-pressed', 'true');
            await expect(light).toHaveValue('171717');
            await saveMutation(pendingMutation, endpoint, 'PUT', async () => {
                await light.fill('112233');
                await light.press('Enter');
            });
            await expect(colors.saved).toBeVisible();
            await expect(heading.getByRole('button', { name: 'Связь с Modes отключена', exact: true })).toHaveAttribute(
                'aria-pressed',
                'false',
            );
            await colorSteps.saveLight('#3366CC', endpoint);
            await expect(light, 'Ручная подтема не следует за новым Light').toHaveValue('112233');
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(light).toHaveValue('112233');
            expect(exactValue(await tokenValues.values(initialTheme.id, 'color'), onlight.id, 'light').value).toEqual([
                '#112233',
            ]);
            await saveMutation(pendingMutation, endpoint, 'PUT', () =>
                heading.getByRole('button', { name: 'Связь с Modes отключена', exact: true }).click(),
            );
            await expect(colors.saved).toBeVisible();
            await expect(linked).toHaveAttribute('aria-pressed', 'true');
            await expect(light).toHaveValue('3366CC');
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(light).toHaveValue('3366CC');
            await expect(linked).toHaveAttribute('aria-pressed', 'true');
            const after = await tokenValues.values(initialTheme.id, 'color');
            expect(exactValue(after, onlight.id, 'light').value).toEqual(['#3366CC']);
            expect(after.filter((value) => value.tokenId === colorData.neighbor.id)).toEqual(
                before.filter((value) => value.tokenId === colorData.neighbor.id),
            );
        },
    );

    test(
        'PLASMABLDR-T787: CT-059 Создание токена и доступность в другой теме',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T787' } },
        async ({
            page,
            colors,
            colorSteps,
            initialTheme,
            themesApi,
            tokenValues,
            createdSystem,
            pendingMutation,
            editorURL,
        }) => {
            const second = await themesApi.create('Theme B');
            const definitions = await tokenValues.definitions();
            await colors.open();
            const add = page.getByRole('button', { name: 'Добавить токен в Status', exact: true });
            await add
                .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " tw-tree-row ")][1]')
                .hover();
            await add.click();
            const name = page.getByRole('textbox', { name: 'Имя нового токена', exact: true });
            await name.fill('SharedColor');
            const root = tokenValues.colorURL(initialTheme.id, 'unused').replace('/unused/values', '');
            await saveMutation(pendingMutation, root, 'POST', () => name.press('Enter'), 201);
            await expect(colors.tokenName).toHaveText('textSharedColor');
            const added = (await tokenValues.definitions()).filter(
                (token) => !definitions.some((before) => before.id === token.id),
            );
            const token = exactDefinition(added, 'text.default.shared-color');
            const secondBefore = await tokenValues.values(second.id, 'color');
            const baselineLight = await colors.light.inputValue();
            const baselineDark = await colors.dark.inputValue();
            expect(exactValue(secondBefore, token.id, 'light').value).toEqual(['#' + baselineLight]);
            expect(exactValue(secondBefore, token.id, 'dark').value).toEqual(['#' + baselineDark]);
            expect(baselineLight).not.toBe('123456');
            await colorSteps.saveLight('#123456', tokenValues.colorURL(initialTheme.id, token.id));
            await colors.switchTheme(createdSystem.name, second.name);
            await expect(page).toHaveURL(
                editorURL.replace(encodeURIComponent(initialTheme.id), encodeURIComponent(second.id)),
            );
            await colors.token('textSharedColor').click();
            await expect(colors.tokenName).toHaveText('textSharedColor');
            await expect(colors.light).toHaveValue(baselineLight);
            await expect(colors.dark).toHaveValue(baselineDark);
            expect(
                await tokenValues.values(second.id, 'color'),
                'Редактирование A не меняет начальные значения B',
            ).toEqual(secondBefore);
            await colors.reload();
            await colors.token('textSharedColor').click();
            await expect(colors.tokenName).toHaveText('textSharedColor');
            await colors.switchTheme(createdSystem.name, initialTheme.name);
            await colors.token('textSharedColor').click();
            await expect(colors.light).toHaveValue('123456');
            expect(exactValue(await tokenValues.values(initialTheme.id, 'color'), token.id, 'light').value).toEqual([
                '#123456',
            ]);
            expect(
                (await tokenValues.definitions()).filter((item) => added.some((newToken) => newToken.id === item.id)),
            ).toEqual(added);
        },
    );
});
