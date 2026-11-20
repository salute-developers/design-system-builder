import { test, expect } from '../fixtures/role-typography.ts';
import { exactDefinition } from '../helpers/color-data.ts';
import { expectTypographyPatch } from '../helpers/typography-checks.ts';
import { commitField, saveTypography, observeWrites } from '../steps/value-editing.steps.ts';

test.use({ memberRole: 'editor', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T703: TYP-UI-034 Валидация Size и Line Height: отрицательное, ноль и нечисловой ввод',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T703' } },
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
        await pageReadiness.run('Открыть валидацию размера и высоты строки', async () => {
            await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
            await typography.selectScreen('Крупные');
        });
        const observed = observeWrites(page, endpoint.replace(/\/[^/]+$/u, ''));
        try {
            for (const [field, original] of [
                [typography.size, '16'],
                [typography.lineHeight, '20'],
            ] as const) {
                for (const raw of ['-1', '0']) {
                    await commitField(field, raw);
                    await expect(field).toHaveAttribute('aria-invalid', 'true');
                    await expect(typography.fieldMessage(field)).toHaveText(
                        'Размер и межстрочный интервал должны быть положительными числами.',
                    );
                    await expect(typography.fieldMessage(field)).toBeVisible();
                    expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(before);
                }
                await commitField(field, 'abc');
                await expect(field).toHaveValue(original);
                expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(before);
            }
            expect(observed.writes).toEqual([]);
            await pageReadiness.run('Невалидный ввод не переживает перезагрузку', async () => {
                await page.reload();
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('16');
            await expect(typography.lineHeight).toHaveValue('20');
            expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(before);
            expect(observed.writes).toEqual([]);
        } finally {
            observed.stop();
        }
        await commitField(typography.size, '-1');
        await expect(typography.size).toHaveAttribute('aria-invalid', 'true');
        await saveTypography(typography, pendingMutation, endpoint, () => commitField(typography.size, '18'));
        await expect(typography.size).toHaveAttribute('aria-invalid', 'false');
        await saveTypography(typography, pendingMutation, endpoint, () => commitField(typography.lineHeight, '24'));
        const after = await tokenValues.values(initialTheme.id, 'typography');
        expectTypographyPatch(before, after, family, {
            web: { fontSize: '1.125rem', lineHeight: '1.5rem' },
            ios: { size: 18, lineHeight: 24 },
            android: { textSize: 18, lineHeight: 24 },
        });
        await pageReadiness.run('Корректный ввод сохраняется после ошибки', async () => {
            await page.reload();
            await typography.selectScreen('Крупные');
        });
        await expect(typography.size).toHaveValue('18');
        await expect(typography.lineHeight).toHaveValue('24');
        await expect(typography.sample).toHaveCSS('font-size', '18px');
        expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(after);
    },
);

test(
    'PLASMABLDR-T704: TYP-UI-036 Валидация трекинга: значения вне диапазона и допустимые границы',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T704' } },
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
        await pageReadiness.run('Открыть границы трекинга', async () => {
            await page.goto(editorURL.replace(/\/colors$/u, '/typography'));
            await typography.selectScreen('Крупные');
        });
        const observed = observeWrites(page, endpoint.replace(/\/[^/]+$/u, ''));
        try {
            for (const raw of ['-0.21', '1.01']) {
                await commitField(typography.letterSpacing, raw);
                await expect(typography.letterSpacing).toHaveAttribute('aria-invalid', 'true');
                await expect(typography.fieldMessage(typography.letterSpacing)).toHaveText(
                    'Letter spacing должен быть в диапазоне от -0.2em до 1em.',
                );
                await expect(typography.fieldMessage(typography.letterSpacing)).toBeVisible();
                expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(before);
            }
            expect(observed.writes).toEqual([]);
        } finally {
            observed.stop();
        }
        let baseline = before;
        for (const [raw, web, native, css] of [
            ['-0.2', '-0.2em', -0.2, '-3.2px'],
            ['1', '1em', 1, '16px'],
        ] as const) {
            await saveTypography(typography, pendingMutation, endpoint, () =>
                commitField(typography.letterSpacing, raw),
            );
            await expect(typography.letterSpacing).toHaveValue(raw);
            await expect(typography.letterSpacing).toHaveAttribute('aria-invalid', 'false');
            await expect(typography.sample).toHaveCSS('letter-spacing', css);
            const after = await tokenValues.values(initialTheme.id, 'typography');
            expectTypographyPatch(baseline, after, family, {
                web: { letterSpacing: web },
                ios: { kerning: native },
                android: { letterSpacing: native },
            });
            baseline = after;
            await pageReadiness.run('Перезагрузить допустимую границу трекинга', async () => {
                await page.reload();
                await typography.selectScreen('Крупные');
            });
            await expect(typography.letterSpacing).toHaveValue(raw);
            await expect(typography.sample).toHaveCSS('letter-spacing', css);
            expect(await tokenValues.values(initialTheme.id, 'typography')).toEqual(after);
        }
    },
);
