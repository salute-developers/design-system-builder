import { test, expect } from '../fixtures/role-typography.ts';
import { typographyBaseline, typographyWebValue } from '../helpers/typography-data.ts';
import { exactDefinition } from '../helpers/color-data.ts';

test.use({ memberRole: 'editor' });

test(
    'PLASMABLDR-T695: TYP-UI-021 Размер, высота строки и трекинг меняют только выбранный экран',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T695' } },
    async ({
        page,
        editorURL,
        initialTheme,
        typographyData,
        typography,
        tokenValues,
        pendingMutation,
        pageReadiness,
    }) => {
        const before = await tokenValues.values(initialTheme.id, 'typography');
        const normal = exactDefinition(typographyData, 'screen-l.body.m.normal');
        const endpoint = new URL(tokenValues.typographyStyleURL(initialTheme.id, normal.id));
        const url = editorURL.replace(/\/colors$/u, '/typography');
        await test.step('Открыть Крупные → Body M с исходными 16/20/0', async () => {
            await pageReadiness.run('Открытие типографики', async () => {
                await page.goto(url);
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('16');
            await expect(typography.lineHeight).toHaveValue('20');
            await expect(typography.letterSpacing).toHaveValue('0');
            await expect(typography.bodyM).toHaveAccessibleName('Body M, 16 px, 20 px line');
        });
        for (const [field, value, property, css] of [
            [typography.size, '22', 'font-size', '22px'],
            [typography.lineHeight, '25', 'line-height', '25px'],
            [typography.letterSpacing, '0.2', 'letter-spacing', '4.4px'],
        ] as const) {
            await test.step('Изменить ' + property + ' через UI Editor и дождаться сохранения', async () => {
                await field.fill(value);
                const started = performance.now();
                const response = await pendingMutation.run(
                    (response) => {
                        const actual = new URL(response.url());
                        return (
                            response.request().method() === 'PATCH' &&
                            actual.origin === endpoint.origin &&
                            actual.pathname === endpoint.pathname
                        );
                    },
                    () => field.press('Enter'),
                    'Сохранение типографики',
                    10_000,
                );
                expect(response.status()).toBe(200);
                await expect(typography.saved).toBeVisible({
                    timeout: Math.max(1, 10_000 - (performance.now() - started)),
                });
                await expect(field).toHaveValue(value);
                await expect(typography.sample).toHaveCSS(property, css);
            });
        }
        await test.step('Reload подтверждает 22/25/0.2 на крупных экранах', async () => {
            await pageReadiness.run('Типографика после reload', async () => {
                await page.reload();
                await typography.selectScreen('Крупные');
            });
            await expect(typography.size).toHaveValue('22');
            await expect(typography.lineHeight).toHaveValue('25');
            await expect(typography.letterSpacing).toHaveValue('0.2');
            await expect(typography.bodyM).toHaveAccessibleName('Body M, 22 px, 25 px line');
            await expect(typography.sample).toHaveCSS('letter-spacing', '4.4px');
        });
        await test.step('Средние и мелкие экраны сохранили исходные значения', async () => {
            for (const { label, size, lineHeight } of typographyBaseline.slice(1)) {
                await typography.selectScreen(label);
                await expect(typography.size).toHaveValue(String(size));
                await expect(typography.lineHeight).toHaveValue(String(lineHeight));
                await expect(typography.letterSpacing).toHaveValue('0');
                await expect(typography.bodyM).toHaveAccessibleName(`Body M, ${size} px, ${lineHeight} px line`);
            }
            const after = await tokenValues.values(initialTheme.id, 'typography');
            expect(typographyWebValue(after, normal.id)).toEqual([
                expect.objectContaining({ fontSize: '1.375rem', lineHeight: '1.5625rem', letterSpacing: '0.2em' }),
            ]);
            for (const token of typographyData.filter((token) => !token.name.startsWith('screen-l.'))) {
                const selected = (values: typeof after) => values.filter((value) => value.tokenId === token.id);
                expect(selected(after), token.name + ' не изменился ни на одной платформе').toEqual(selected(before));
            }
        });
    },
);
