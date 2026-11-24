import { test, expect } from '../fixtures/typography-isolation.ts';
import { exactDefinition } from '../helpers/color-data.ts';
import { typographyWebValue } from '../helpers/typography-data.ts';
import { saveMutation } from '../helpers/save-mutation.ts';

test.use({ viewport: { width: 1440, height: 900 } });
test.describe('Изоляция типографики', () => {
    test(
        'PLASMABLDR-T698: TYP-UI-026 Правка темы A не меняет тему B',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T698' } },
        async ({
            page,
            colors,
            createdSystem,
            editorURL,
            initialTheme,
            typographyIsolation,
            typography,
            tokenValues,
            pendingMutation,
            pageReadiness,
        }) => {
            const { second, definitions } = typographyIsolation;
            const normal = exactDefinition(definitions, 'screen-l.body.m.normal');
            const beforeA = await tokenValues.values(initialTheme.id, 'typography');
            const beforeB = await tokenValues.values(second.id, 'typography');
            const typographyURL = editorURL.replace(/\/colors$/u, '/typography');
            await pageReadiness.run('Открыть типографику A', async () => {
                await page.goto(typographyURL);
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('16');
            await saveMutation(
                pendingMutation,
                tokenValues.typographyStyleURL(initialTheme.id, normal.id),
                'PATCH',
                async () => {
                    await typography.size.fill('22');
                    await typography.size.press('Enter');
                },
            );
            await expect(typography.saved).toBeVisible();
            await expect(typography.sample).toHaveCSS('font-size', '22px');
            await colors.switchTheme(createdSystem.name, second.name);
            await pageReadiness.run('Открыть типографику B', async () => {
                await page.goto(
                    typographyURL.replace(encodeURIComponent(initialTheme.id), encodeURIComponent(second.id)),
                );
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('16');
            await expect(typography.lineHeight).toHaveValue('20');
            await expect(typography.sample).toHaveCSS('font-size', '16px');
            await colors.switchTheme(createdSystem.name, initialTheme.name);
            await pageReadiness.run('Вернуться в типографику A и перезагрузить', async () => {
                await page.goto(typographyURL);
                await page.reload();
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('22');
            await expect(typography.lineHeight).toHaveValue('20');
            const afterA = await tokenValues.values(initialTheme.id, 'typography');
            expect(typographyWebValue(afterA, normal.id)).toEqual([expect.objectContaining({ fontSize: '1.375rem' })]);
            const unchanged = (values: typeof afterA) =>
                values.filter(
                    (value) =>
                        !definitions
                            .filter((token) => token.name.startsWith('screen-l.'))
                            .some((token) => token.id === value.tokenId),
                );
            expect(unchanged(afterA)).toEqual(unchanged(beforeA));
            expect(await tokenValues.values(second.id, 'typography'), 'B не получила значений или ревизий A').toEqual(
                beforeB,
            );
        },
    );

    test(
        'PLASMABLDR-T798: TYP-UI-027 Свой Size iOS, изменение Web и сброс Android',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T798' } },
        async ({
            page,
            editorURL,
            initialTheme,
            typographyIsolation,
            typography,
            tokenValues,
            pendingMutation,
            pageReadiness,
        }) => {
            const normal = exactDefinition(typographyIsolation.definitions, 'screen-l.body.m.normal');
            const endpoint = tokenValues.typographyStyleURL(initialTheme.id, normal.id);
            const baseline = await tokenValues.values(initialTheme.id, 'typography');
            await pageReadiness.run('Открыть типографику и платформы Size', async () => {
                await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
                await typography.selectScreen('Крупные');
            });
            const row = page
                .locator('.typography-overridable')
                .filter({ has: page.getByRole('textbox', { name: 'Size', exact: true }) });
            const ownIOS = row.getByRole('textbox', { name: 'Size iOS', exact: true });
            const ownAndroid = row.getByRole('textbox', { name: 'Size Android', exact: true });
            const add = row.getByRole('button', { name: 'Своё значение платформы', exact: true });
            for (const [platform, field, size] of [
                ['iOS', ownIOS, '19'],
                ['Android', ownAndroid, '21'],
            ] as const) {
                await add.click();
                await row.getByRole('menuitem', { name: platform, exact: true }).click();
                await saveMutation(pendingMutation, endpoint, 'PATCH', async () => {
                    await field.fill(size);
                    await field.press('Enter');
                });
                await expect(typography.saved).toBeVisible();
                await expect(field).toHaveValue(size);
            }
            const overrides = await tokenValues.values(initialTheme.id, 'typography');
            await saveMutation(pendingMutation, endpoint, 'PATCH', async () => {
                await typography.size.fill('24');
                await typography.size.press('Enter');
            });
            await expect(typography.saved).toBeVisible();
            await expect(typography.size).toHaveValue('24');
            await expect(ownIOS).toHaveValue('19');
            await expect(ownAndroid).toHaveValue('21');
            const beforeReset = await tokenValues.values(initialTheme.id, 'typography');
            const ownValues = (values: typeof beforeReset, platform: string) =>
                values.filter(
                    (value) =>
                        value.platform === platform &&
                        typographyIsolation.definitions
                            .filter((token) => token.name.startsWith('screen-l.'))
                            .some((token) => token.id === value.tokenId),
                );
            expect(ownValues(beforeReset, 'ios')).toEqual(ownValues(overrides, 'ios'));
            expect(ownValues(beforeReset, 'android')).toEqual(ownValues(overrides, 'android'));
            await saveMutation(pendingMutation, endpoint, 'PATCH', () =>
                row.getByRole('button', { name: 'Убрать своё значение Android', exact: true }).click(),
            );
            await expect(typography.saved).toBeVisible();
            await expect(ownAndroid).toHaveCount(0);
            await pageReadiness.run('Повторно открыть платформенные значения', async () => {
                await page.reload();
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('24');
            await expect(ownIOS).toHaveValue('19');
            await expect(ownAndroid).toHaveCount(0);
            await expect(typography.sample).toHaveCSS('font-size', '24px');
            const after = await tokenValues.values(initialTheme.id, 'typography');
            expect(ownValues(after, 'ios')).toEqual(ownValues(beforeReset, 'ios'));
            for (const token of typographyIsolation.definitions.filter((token) => token.name.startsWith('screen-l.'))) {
                for (const [platform, sizeKey, size] of [
                    ['android', 'textSize', 24],
                    ['ios', 'size', 19],
                ] as const) {
                    const values = after.filter((value) => value.tokenId === token.id && value.platform === platform);
                    expect(values, token.name + '/' + platform).toHaveLength(1);
                    expect(values[0]!.value).toEqual([expect.objectContaining({ [sizeKey]: size })]);
                    // Типографика выводит своё поле из различия значений платформ, не из общего флага overridden.
                }
            }
            const otherScreens = (values: typeof after) =>
                values.filter(
                    (value) =>
                        !typographyIsolation.definitions
                            .filter((token) => token.name.startsWith('screen-l.'))
                            .some((token) => token.id === value.tokenId),
                );
            expect(otherScreens(after)).toEqual(otherScreens(baseline));
        },
    );
});
