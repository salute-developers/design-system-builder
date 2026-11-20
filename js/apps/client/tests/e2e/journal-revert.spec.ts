import type { Request } from '@playwright/test';
import { expect, test } from '../fixtures/colors.ts';

test(
    'PLASMABLDR-T647: VER-UI-007 Отмена изменения из строки журнала',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T647' } },
    async ({ page, changedColor, colors, journal, versionsApi, pendingMutation, createdSystem, initialTheme }) => {
        const changes = await versionsApi.changes();
        expect(changes, 'Ровно одна подготовленная правка после 0.1.0').toHaveLength(1);
        expect(changes[0]).toMatchObject({ changeId: expect.any(String), operation: 'updated' });
        const endpoint = new URL(versionsApi.revertURL((changes[0] as { changeId: string }).changeId));
        const isRevert = (request: Request) => {
            const url = new URL(request.url());
            return request.method() === 'POST' && url.origin === endpoint.origin && url.pathname === endpoint.pathname;
        };
        let requests = 0;
        const count = (request: Request) => {
            if (isRevert(request)) requests += 1;
        };
        page.on('request', count);
        try {
            await test.step('Открыть журнал своей ДС с единственной правкой Light textAccent', async () => {
                await journal.open();
                await expect(colors.breadcrumb.getByText(createdSystem.name, { exact: true })).toBeVisible();
                await expect(colors.breadcrumb.getByText(initialTheme.name, { exact: true })).toBeVisible();
                await expect(journal.list.getByRole('article')).toHaveCount(1);
                await expect(journal.colorChange('textAccent')).toBeVisible();
                await expect(journal.list.getByText('1 изменение', { exact: true })).toBeVisible();
            });

            await test.step('Один раз отменить запись и подтвердить блокировку повторного действия', async () => {
                const undo = journal.undoColorChange('textAccent');
                const started = performance.now();
                const disabled = expect(undo).toBeDisabled();
                const reverted = pendingMutation.run(
                    (response) => isRevert(response.request()),
                    () => undo.click(),
                    'Отмена изменения из строки журнала',
                    10_000,
                );
                const outcomes = await Promise.allSettled([reverted, disabled]);
                for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
                const result = outcomes[0];
                if (result?.status !== 'fulfilled') throw new Error('Ответ отмены не подтверждён.');
                expect(result.value.status()).toBe(200);
                expect(result.value.request().postDataJSON()).toEqual({ paths: ['/value'] });
                await expect(journal.emptyHeading).toBeVisible({
                    timeout: Math.max(1, 10_000 - (performance.now() - started)),
                });
                expect(
                    performance.now() - started,
                    'Ответ и обновлённый журнал не дольше 10 секунд',
                ).toBeLessThanOrEqual(10_000);
                await expect(journal.list.getByRole('article')).toHaveCount(0);
                await expect(journal.list.getByText('0 изменений', { exact: true })).toBeVisible();
                expect(requests).toBe(1);
            });

            await test.step('Проверить восстановленное значение и сохранение после reload', async () => {
                await colors.navigationButton.click();
                await colors.token('textAccent').click();
                await expect(colors.tokenName).toHaveText('textAccent');
                await expect(colors.light).toHaveValue('171717');
                await colors.reload();
                await colors.token('textAccent').click();
                await expect(colors.light).toHaveValue('171717');
                await expect(colors.dark).toHaveValue('F5F5F5');
                await journal.navigationButton.click();
                await expect(journal.emptyHeading).toBeVisible();
                expect(await versionsApi.changes()).toEqual([]);
                expect(changedColor.accent.name).toBe('text.default.accent');
                expect(requests, 'Навигация и reload не повторяют отмену').toBe(1);
            });
        } finally {
            page.off('request', count);
        }
    },
);
