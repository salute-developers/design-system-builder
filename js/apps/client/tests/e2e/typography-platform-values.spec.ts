import { test, expect } from '../fixtures/role-typography.ts';
import { typographyBaseline } from '../helpers/typography-data.ts';
import { exactDefinition } from '../helpers/color-data.ts';
import { expectTypographyPatch } from '../helpers/typography-checks.ts';
import { commitField, saveTypography } from '../steps/value-editing.steps.ts';

test.use({ memberRole: 'editor', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T696: TYP-UI-024 Вес Bold меняется на всех экранах без изменения Regular и Medium',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T696' } },
    async ({
        page,
        editorURL,
        typography,
        typographyData,
        tokenValues,
        initialTheme,
        pendingMutation,
        pageReadiness,
    }) => {
        const before = await tokenValues.values(initialTheme.id, 'typography');
        const normal = exactDefinition(typographyData, 'screen-l.body.m.normal');
        const boldIds = typographyBaseline.map(
            ({ screen }) => exactDefinition(typographyData, `screen-${screen}.body.m.bold`).id,
        );
        const endpoint = tokenValues.typographyStyleURL(initialTheme.id, normal.id);
        await pageReadiness.run('Открыть типографику Bold', async () => {
            await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
            await typography.selectScreen('Крупные');
        });
        await typography.selectVariant('Bold');
        await expect(typography.weight('Bold')).toHaveText('600');
        await saveTypography(typography, pendingMutation, endpoint, () => typography.setWeight('Bold', '700 / Bold'));
        const after = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(before, after, boldIds, {
            web: { fontWeight: '700' },
            android: { fontWeight: 700 },
            ios: { weight: 'bold' },
        });
        for (const { label, size, lineHeight } of typographyBaseline) {
            await typography.selectScreen(label);
            await expect(typography.weight('Bold')).toHaveText('700');
            await expect(typography.sample).toHaveCSS('font-weight', '700');
            await expect(typography.size).toHaveValue(String(size));
            await expect(typography.lineHeight).toHaveValue(String(lineHeight));
            for (const [variant, weight] of [
                ['Regular', '400'],
                ['Medium', '500'],
            ] as const) {
                await typography.selectVariant(variant);
                await expect(typography.weight(variant)).toHaveText(weight);
            }
            await typography.selectVariant('Bold');
        }
        await pageReadiness.run('Повторно открыть вес Bold', async () => {
            await page.reload();
            await typography.selectScreen('Крупные');
        });
        await typography.selectVariant('Bold');
        await expect(typography.weight('Bold')).toHaveText('700');
        expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(after);
    },
);

test(
    'PLASMABLDR-T700: TYP-UI-029 Своё значение Android: высота строки',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T700' } },
    async ({
        page,
        editorURL,
        typography,
        typographyData,
        tokenValues,
        initialTheme,
        pendingMutation,
        pageReadiness,
    }) => {
        const family = ['normal', 'medium', 'bold'].map(
            (variant) => exactDefinition(typographyData, `screen-l.body.m.${variant}`).id,
        );
        const endpoint = tokenValues.typographyStyleURL(initialTheme.id, family[0]!);
        const before = await tokenValues.values(initialTheme.id, 'typography');
        const own = page.getByRole('textbox', { name: 'Line Height Android', exact: true });
        const save = (action: () => Promise<unknown>) => saveTypography(typography, pendingMutation, endpoint, action);
        await pageReadiness.run('Открыть высоту строки Android', async () => {
            await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
            await typography.selectScreen('Крупные');
        });
        await typography.addPlatform(typography.lineHeight, 'Android');
        await save(() => commitField(own, '22'));
        const overridden = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(before, overridden, family, { android: { lineHeight: 22 } });
        await save(() => commitField(typography.lineHeight, '26'));
        await expect(own).toHaveValue('22');
        await expect(typography.lineHeight).toHaveValue('26');
        await expect(typography.sample).toHaveCSS('line-height', '26px');
        const afterWeb = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(overridden, afterWeb, family, {
            web: { lineHeight: '1.625rem' },
            ios: { lineHeight: 26 },
        });
        await pageReadiness.run('Собственная высота строки переживает перезагрузку', async () => {
            await page.reload();
            await typography.selectScreen('Крупные');
        });
        await expect(own).toHaveValue('22');
        await save(() =>
            typography
                .overrideRow(typography.lineHeight)
                .getByRole('button', { name: 'Убрать своё значение Android', exact: true })
                .click(),
        );
        await expect(own).toHaveCount(0);
        const after = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(afterWeb, after, family, { android: { lineHeight: 26 } });
        await pageReadiness.run('Наследование высоты строки после снятия', async () => {
            await page.reload();
            await typography.selectScreen('Крупные');
        });
        await expect(own).toHaveCount(0);
        await expect(typography.lineHeight).toHaveValue('26');
        await expect(typography.size).toHaveValue('16');
        expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(after);
    },
);

test(
    'PLASMABLDR-T702: TYP-UI-032 Свой вес Bold iOS',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T702' } },
    async ({
        page,
        editorURL,
        typography,
        typographyData,
        tokenValues,
        initialTheme,
        pendingMutation,
        pageReadiness,
    }) => {
        const normal = exactDefinition(typographyData, 'screen-l.body.m.normal');
        const boldIds = typographyBaseline.map(
            ({ screen }) => exactDefinition(typographyData, `screen-${screen}.body.m.bold`).id,
        );
        const endpoint = tokenValues.typographyStyleURL(initialTheme.id, normal.id);
        const before = await tokenValues.values(initialTheme.id, 'typography');
        await pageReadiness.run('Открыть собственный вес Bold iOS', async () => {
            await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
            await typography.selectScreen('Крупные');
        });
        await typography.selectVariant('Bold');
        await typography.addPlatform(typography.weight('Bold'), 'iOS');
        await saveTypography(typography, pendingMutation, endpoint, () =>
            typography.setWeight('Bold', '800 / ExtraBold', 'iOS'),
        );
        const own = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(before, own, boldIds, { ios: { weight: 'heavy' } });
        await saveTypography(typography, pendingMutation, endpoint, () => typography.setWeight('Bold', '700 / Bold'));
        const after = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(own, after, boldIds, { web: { fontWeight: '700' }, android: { fontWeight: 700 } });
        for (const { label, size } of typographyBaseline) {
            await typography.selectScreen(label);
            await expect(typography.weight('Bold')).toHaveText('700');
            await expect(typography.weight('Bold', 'iOS')).toHaveText('800');
            await expect(typography.size).toHaveValue(String(size));
            for (const [variant, weight] of [
                ['Regular', '400'],
                ['Medium', '500'],
            ] as const) {
                await typography.selectVariant(variant);
                await expect(typography.weight(variant)).toHaveText(weight);
                await expect(typography.weight(variant, 'iOS')).toHaveCount(0);
            }
            await typography.selectVariant('Bold');
        }
        await pageReadiness.run('Вес Bold iOS переживает перезагрузку', async () => {
            await page.reload();
            await typography.selectScreen('Крупные');
        });
        await typography.selectVariant('Bold');
        await expect(typography.weight('Bold')).toHaveText('700');
        await expect(typography.weight('Bold', 'iOS')).toHaveText('800');
        expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(after);
    },
);
