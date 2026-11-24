import { test, expect } from '../fixtures/palette-dependencies.ts';
import { paletteGroup, paletteRamp, paletteStep, paletteLinkedValues, green, blue } from '../helpers/palette.api.ts';
import { exactValue } from '../helpers/color-data.ts';
import { saveMutation } from '../helpers/save-mutation.ts';
import type { ThemePalette } from '../helpers/palette.api.ts';
import type { TokenValue } from '../helpers/token-values.api.ts';
import { cssColor } from '../steps/palette.steps.ts';

// Compare stored values and revisions; GET resolves palette references to HEX.
function storedValues(values: readonly TokenValue[]) {
    return values.map(({ value, paletteRef, sourceValue, ...metadata }) => ({
        ...metadata,
        value: paletteRef ?? sourceValue ?? value,
    }));
}

// Счётчики зависимостей меняются при редактировании токенов, содержимое палитры — нет.
function paletteContent(palette: ThemePalette) {
    return {
        ...palette,
        groups: palette.groups.map((group) => ({
            ...group,
            ramps: group.ramps.map(({ linkedCount: _rampCount, steps, ...ramp }) => ({
                ...ramp,
                steps: steps.map(({ linkedCount: _stepCount, ...step }) => step),
            })),
        })),
    };
}

test.use({ viewport: { width: 1440, height: 900 } });
test.describe('Связи палитры', () => {
    test(
        'PLASMABLDR-T615: CT-031 Прозрачность связанного цвета сохраняет ссылку',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T615' } },
        async ({
            page,
            translucentPalette,
            colors,
            colorData,
            initialTheme,
            tokenValues,
            paletteApi,
            pendingMutation,
        }) => {
            await colors.open();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('Green 500');
            const alpha = colors.lightOpacity;
            await expect(alpha).toHaveValue('80');
            const before = await tokenValues.values(initialTheme.id, 'color');
            await saveMutation(
                pendingMutation,
                tokenValues.colorURL(initialTheme.id, colorData.accent.id),
                'PUT',
                async () => {
                    await alpha.fill('40');
                    await alpha.press('Enter');
                    await page.getByRole('main').getByRole('heading', { name: 'Text & Icons', exact: true }).click();
                },
            );
            await expect(colors.saved).toBeVisible();
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('Green 500');
            await expect(colors.light).toHaveAttribute('readonly', '');
            await expect(alpha).toHaveValue('40');
            const after = await tokenValues.values(initialTheme.id, 'color');
            expect(exactValue(after, colorData.accent.id, 'light').paletteRef).toBe('[additional.h130.500][0.4]');
            expect(exactValue(after, colorData.accent.id, 'dark')).toEqual(
                exactValue(before, colorData.accent.id, 'dark'),
            );
            expect(paletteContent(await paletteApi.get()), 'Прозрачность ссылки не изменяет палитру').toEqual(
                paletteContent(translucentPalette),
            );
        },
    );

    test(
        'PLASMABLDR-T777: PAL-022 Picker ступени и прозрачность ссылки',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T777' } },
        async ({
            translucentPalette,
            colors,
            colorSteps,
            palette,
            colorData,
            initialTheme,
            tokenValues,
            paletteApi,
        }) => {
            const accent = paletteGroup(translucentPalette, 'accent');
            const hex = paletteStep(accent, green, 400).value;
            await colors.open();
            await colors.token('textAccent').click();
            await colors.openLight();
            await expect(colors.libraryTab).toHaveAttribute('aria-pressed', 'true');
            await colorSteps.selectLibraryStep(
                'Green',
                400,
                hex,
                tokenValues.colorURL(initialTheme.id, colorData.accent.id),
            );
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('Green 400');
            await expect(colors.lightOpacity).toHaveValue('80');
            expect(
                exactValue(await tokenValues.values(initialTheme.id, 'color'), colorData.accent.id, 'light').paletteRef,
            ).toBe('[additional.h130.400][0.8]');
            await colors.openLight();
            await expect(colors.libraryStep('Green', 400, hex)).toHaveClass(/\bis-active\b/u);
            await colors.closePicker();
            await palette.navigationButton.click();
            await palette.waitForReady();
            await palette.colorMode.click();
            const step = palette.step(accent.id, green, 400);
            await step.click();
            await expect(step).toHaveCSS('background-color', cssColor(hex));
            await expect(palette.inspector.getByRole('button', { name: /textAccent.*Открыть/u })).toBeVisible();
            expect(paletteContent(await paletteApi.get())).toEqual(paletteContent(translucentPalette));
        },
    );

    test(
        'PLASMABLDR-T775: PAL-018 Замена растяжки: сохранение, связи и журнал',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T775' } },
        async ({
            page,
            linkedPaletteBaseline,
            linkedColor,
            palette,
            paletteApi,
            tokenValues,
            initialTheme,
            pendingMutation,
            journal,
            versionsApi,
        }) => {
            const accent = paletteGroup(linkedPaletteBaseline, 'accent');
            const values = await tokenValues.values(initialTheme.id, 'color');
            const linkedBefore = paletteLinkedValues(linkedPaletteBaseline, values, accent.id, '[additional.h130.500]');
            expect(linkedBefore, 'Подготовленные ссылки входят в зависимости Accent').toEqual(
                expect.arrayContaining(linkedColor.references.map((reference) => expect.objectContaining(reference))),
            );
            const template = linkedPaletteBaseline.template.find(
                (item) => item.type === blue.type && item.shade === blue.shade,
            )!;
            expect(template).toBeDefined();
            await palette.open();
            await palette.rampMode.click();
            await palette.rampCard(accent.label, 'Green', 'Hue130').click();
            const dialog = page.getByRole('dialog', { name: 'Настройка палитры Green', exact: true });
            await dialog.getByRole('tab', { name: 'Поменять', exact: true }).click();
            const url = paletteApi.stepURL(accent.id, green, 500).replace('/steps/500', '/source');
            await saveMutation(pendingMutation, url, 'PUT', () =>
                dialog
                    .getByRole('button')
                    .filter({ has: page.getByText('Hue200', { exact: true }) })
                    .click(),
            );
            await page
                .getByRole('dialog', { name: 'Настройка палитры Blue', exact: true })
                .getByRole('button', { name: 'Закрыть', exact: true })
                .click();
            const after = await paletteApi.get();
            const ramp = paletteRamp(paletteGroup(after, 'accent'), green);
            expect(ramp).toMatchObject({ source: blue });
            for (const step of template.steps)
                expect(paletteStep(paletteGroup(after, 'accent'), green, step.step).value).toBe(step.value);
            for (const group of linkedPaletteBaseline.groups.filter((group) => group.id !== accent.id)) {
                expect(after.groups.find((item) => item.id === group.id)).toEqual(group);
            }
            const tokenValuesAfter = await tokenValues.values(initialTheme.id, 'color');
            expect(storedValues(tokenValuesAfter), 'Адреса семантических ссылок сохранены').toEqual(
                storedValues(values),
            );
            for (const previous of linkedBefore) {
                const current = tokenValuesAfter.find(
                    (value) =>
                        value.tokenId === previous.tokenId &&
                        value.platform === previous.platform &&
                        value.mode === previous.mode,
                );
                expect(current?.value, 'Цвет ссылки раскрыт по новому источнику').toEqual([
                    template.steps.find((step) => step.step === 500)!.value,
                ]);
            }
            const changes = await versionsApi.changes();
            expect(changes).toHaveLength(1);
            expect(changes[0]).toMatchObject({ entityType: 'palette-ramp' });
            await journal.navigationButton.click();
            await journal.waitForReady();
            await expect(journal.list.getByRole('article')).toHaveCount(1);
            await expect(journal.list).toContainText('Accent');
            await palette.open();
            await palette.reload();
            await palette.colorMode.click();
            await expect(palette.step(accent.id, green, 500)).toHaveCSS(
                'background-color',
                cssColor(template.steps.find((step) => step.step === 500)!.value),
            );
            expect(paletteRamp(paletteGroup(await paletteApi.get(), 'accent'), green)).toEqual(ramp);
        },
    );

    test(
        'PLASMABLDR-T591: PAL-026 Safe Delete требует replacement и выполняет re-link + delete',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T591' } },
        async ({
            page,
            linkedPaletteBaseline,
            palette,
            paletteApi,
            tokenValues,
            initialTheme,
            linkedColor,
            pendingMutation,
            colors,
        }) => {
            const accent = paletteGroup(linkedPaletteBaseline, 'accent');
            const before = await tokenValues.values(initialTheme.id, 'color');
            const affected = paletteLinkedValues(linkedPaletteBaseline, before, accent.id, '[additional.h130.500]');
            expect(affected.length, 'Подготовлены зависимости удаляемой растяжки').toBeGreaterThan(0);
            expect(affected, 'Все подготовленные ссылки входят в зависимости Accent').toEqual(
                expect.arrayContaining(linkedColor.references.map((reference) => expect.objectContaining(reference))),
            );
            await palette.open();
            await palette.rampMode.click();
            await palette.removeRamp(accent.label, 'Green', 'Green / Hue 130');
            const dialog = page.getByRole('dialog', { name: 'Убрать Green из группы?', exact: true });
            await expect(dialog.getByRole('button', { name: 'Убрать из группы', exact: true })).toBeDisabled();
            await dialog
                .getByRole('option')
                .filter({ has: page.getByText('Hue200', { exact: true }) })
                .click();
            await expect(
                dialog.getByRole('option').filter({ has: page.getByText('Hue200', { exact: true }) }),
            ).toHaveAttribute('aria-selected', 'true');
            const url = paletteApi.stepURL(accent.id, green, 500).replace('/steps/500', '');
            await saveMutation(pendingMutation, url, 'DELETE', () =>
                dialog.getByRole('button', { name: 'Заменить', exact: true }).click(),
            );
            await expect(dialog).toHaveCount(0);
            const after = await paletteApi.get();
            expect(
                paletteGroup(after, 'accent').ramps.some(
                    (ramp) => ramp.slot.shade === green.shade && ramp.slot.type === green.type,
                ),
            ).toBe(false);
            for (const group of linkedPaletteBaseline.groups.filter((group) => group.id !== accent.id))
                expect(after.groups.find((item) => item.id === group.id)).toEqual(group);
            const values = await tokenValues.values(initialTheme.id, 'color');
            for (const value of affected) {
                expect(
                    values.find(
                        (item) =>
                            item.tokenId === value.tokenId &&
                            item.platform === value.platform &&
                            item.mode === value.mode,
                    )?.paletteRef,
                ).toBe('[additional.h200.500]');
            }
            await palette.reload();
            expect(await paletteApi.get()).toEqual(after);
            await colors.open();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('Blue 500');
        },
    );

    test(
        'PLASMABLDR-T606: PAL-042 Отмена Safe Delete сохраняет Palette и dependencies',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T606' } },
        async ({
            page,
            environment,
            systemsApi,
            createdSystem,
            linkedPaletteBaseline,
            palette,
            paletteApi,
            tokenValues,
            initialTheme,
            versionsApi,
        }) => {
            const accent = paletteGroup(linkedPaletteBaseline, 'accent');
            const values = await tokenValues.values(initialTheme.id, 'color');
            const scope = new URL(
                `api/projects/${encodeURIComponent(systemsApi.projectId)}/design-systems/${encodeURIComponent(createdSystem.id)}`,
                environment.gatewayBaseURL,
            );
            const writes: string[] = [];
            const observe = (request: import('@playwright/test').Request) => {
                const url = new URL(request.url());
                if (
                    url.origin === scope.origin &&
                    (url.pathname === scope.pathname || url.pathname.startsWith(scope.pathname + '/')) &&
                    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
                )
                    writes.push(request.method() + ' ' + url.pathname);
            };
            page.on('request', observe);
            try {
                await palette.open();
                await palette.rampMode.click();
                await palette.removeRamp(accent.label, 'Green', 'Green / Hue 130');
                const dialog = page.getByRole('dialog', { name: 'Убрать Green из группы?', exact: true });
                await expect(dialog.getByRole('button', { name: 'Убрать из группы', exact: true })).toBeDisabled();
                await dialog
                    .getByRole('option')
                    .filter({ has: page.getByText('Hue200', { exact: true }) })
                    .click();
                await dialog.getByRole('button', { name: 'Не удалять', exact: true }).click();
                await expect(dialog).toHaveCount(0);
                await palette.reload();
                expect(await paletteApi.get()).toEqual(linkedPaletteBaseline);
                expect(await tokenValues.values(initialTheme.id, 'color')).toEqual(values);
                expect(await versionsApi.changes()).toEqual([]);
                expect(writes).toEqual([]);
            } finally {
                page.off('request', observe);
            }
        },
    );

    test(
        'PLASMABLDR-T590: PAL-025 Удаление растяжки без связанных токенов',
        { annotation: { type: 'zephyr', description: 'PLASMABLDR-T590' } },
        async ({ page, paletteData, palette, paletteApi, tokenValues, initialTheme, pendingMutation }) => {
            const accent = paletteGroup(paletteData, 'accent');
            const values = await tokenValues.values(initialTheme.id, 'color,gradient');
            await palette.open();
            await palette.rampMode.click();
            await palette.removeRamp(accent.label, 'Blue', 'Blue / Hue 200');
            const dialog = page.getByRole('dialog', { name: 'Убрать Blue из группы?', exact: true });
            await expect(dialog.getByText('В этой группе нет связанных токенов.', { exact: true })).toBeVisible();
            await expect(dialog.getByRole('listbox', { name: 'Замена', exact: true })).toHaveCount(0);
            const url = paletteApi.stepURL(accent.id, blue, 500).replace('/steps/500', '');
            await saveMutation(pendingMutation, url, 'DELETE', () =>
                dialog.getByRole('button', { name: 'Убрать из группы', exact: true }).click(),
            );
            await expect(dialog).toHaveCount(0);
            await palette.reload();
            const after = await paletteApi.get();
            expect(paletteGroup(after, 'accent').ramps).toEqual(
                accent.ramps.filter((ramp) => ramp.slot.type !== blue.type || ramp.slot.shade !== blue.shade),
            );
            for (const group of paletteData.groups.filter((group) => group.id !== accent.id))
                expect(after.groups.find((item) => item.id === group.id)).toEqual(group);
            expect(await tokenValues.values(initialTheme.id, 'color,gradient')).toEqual(values);
            await expect(palette.rampRow(accent.label, 'Blue / Hue 200')).toHaveCount(0);
        },
    );
});
