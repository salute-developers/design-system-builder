import { expect, test } from '../fixtures/versions.ts';

test(
    'PLASMABLDR-T792: VER-UI-002 Пустой черновик: журнал и запрет публикации',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T792' } },
    async ({ page, baselineVersion, journal, versions, editorURL, publications }) => {
        await test.step('Открыть пустой журнал после подготовленной публикации', async () => {
            await journal.open();
            await expect(journal.emptyHeading).toBeVisible();
            await expect(journal.emptyDescription).toBeVisible();
            await expect(journal.list.getByRole('alert')).toHaveCount(0);
        });

        await test.step('Пустой черновик недоступен для публикации', async () => {
            await versions.navigationButton.click();
            await expect(versions.draftButton).toHaveAttribute('aria-pressed', 'true');
            await expect(versions.emptyMessage).toBeVisible();
            await expect(versions.publishButton).toBeDisabled();
            await expect(versions.version(baselineVersion.version)).toHaveCount(1);
        });

        await test.step('Вернуться в редактор той же темы', async () => {
            await versions.editorButton.click();
            await expect(page).toHaveURL(editorURL);
            await expect(versions.editorReady).toBeVisible();
            await expect(versions.editorVersionButton).toHaveText('Черновик');
            expect(publications(), 'Публикация пустого черновика не отправлялась').toBe(0);
        });
    },
);

test(
    'PLASMABLDR-T660: VER-UI-020 Публикация непустого черновика с пустым описанием',
    { tag: '@smoke', annotation: { type: 'zephyr', description: 'PLASMABLDR-T660' } },
    async ({
        page,
        createdSystem,
        baselineVersion,
        pendingTheme,
        versions,
        versionsApi,
        publications,
        pendingMutation,
    }) => {
        await test.step('Проверить состав публикации и оставить описание пустым', async () => {
            await versions.open();
            await expect(versions.change(pendingTheme.name)).toBeVisible();
            await versions.versionInput.fill('0.1.1');
            await versions.notesInput.fill('');
            await expect(versions.notesInput).toHaveValue('');
            await expect(versions.publishButton).toBeEnabled();
        });

        const published = await test.step('Опубликовать через UI одним POST 201', async () => {
            const endpoint = new URL(versionsApi.createURL);
            const response = await pendingMutation.run(
                (response) => {
                    const actual = new URL(response.url());
                    return (
                        response.request().method() === 'POST' &&
                        actual.origin === endpoint.origin &&
                        actual.pathname === endpoint.pathname
                    );
                },
                () => versions.publishButton.click(),
                'Публикация версии',
            );
            expect(response.status()).toBe(201);
            const raw: unknown = await response.json();
            expect(raw).toMatchObject({
                id: expect.stringMatching(/\S/u),
                designSystemId: createdSystem.id,
                version: '0.1.1',
                changelog: '',
            });
            await expect(versions.publicationMessage('0.1.1')).toBeVisible();
            await expect(versions.version('0.1.1')).toHaveCount(1);
            expect(publications(), 'Отправлена одна публикация').toBe(1);
            return raw as { id: string };
        });

        await test.step('Новый черновик пуст, опубликованная история сохранена', async () => {
            await versions.draftButton.click();
            await expect(versions.emptyMessage).toBeVisible();
            await expect(versions.publishButton).toBeDisabled();
            await page.reload();
            await expect(versions.emptyMessage).toBeVisible();
            await expect(versions.version(baselineVersion.version)).toHaveCount(1);
            await versions.version('0.1.1').click();
            await expect(page).toHaveURL((url) => url.searchParams.get('historyVersionId') === published.id);
            await expect(versions.change(pendingTheme.name)).toBeVisible();
            await expect(versions.notesSection).toHaveText('Примечания к версии');
            await expect(versions.readOnly).toBeVisible();
            await expect(versions.versionInput).toHaveCount(0);
            await expect(versions.notesInput).toHaveCount(0);
            await expect(versions.publishButton).toHaveCount(0);
            expect(publications(), 'Навигация и reload не публикуют повторно').toBe(1);
        });
    },
);

test(
    'PLASMABLDR-T657: VER-UI-017 История в разделе версий не переключает версию редактора',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T657' } },
    async ({ page, history, initialTheme, versions, editorURL, publications }) => {
        await test.step('Открыть черновик с двумя подготовленными публикациями', async () => {
            await versions.open();
            await versions.editorVersionButton.click();
            await versions.editorDraftOption.click();
            await expect(versions.editorVersionButton).toHaveText('Черновик');
            await expect(versions.version(history.first.version)).toHaveCount(1);
            await expect(versions.version(history.second.version)).toHaveCount(1);
        });

        await test.step('Выбрать старую публикацию только в истории', async () => {
            await versions.version(history.first.version).click();
            await expect(page).toHaveURL(
                (url) =>
                    url.searchParams.get('historyVersionId') === history.first.id && !url.searchParams.has('versionId'),
            );
            await expect(versions.content).toContainText('v' + history.first.version);
            await expect(versions.content.getByText(/^Опубликована · \d/u)).toBeVisible();
            await expect(versions.content.getByText(history.first.changelog, { exact: true })).toBeVisible();
            await expect(versions.change(initialTheme.name)).toBeVisible();
            await expect(versions.editorVersionButton).toHaveText('Черновик');
        });

        await test.step('Редактор сохранил актуальный черновик и доступность правки', async () => {
            await versions.editorButton.click();
            await expect(page).toHaveURL(editorURL);
            await expect(versions.editorReady).toBeVisible();
            await expect(versions.editorVersionButton).toHaveText('Черновик');
            await expect(
                page
                    .getByRole('navigation', { name: 'Навигация темы' })
                    .getByText(history.draftTheme.name, { exact: true }),
            ).toBeVisible();
            await expect(versions.editorSettingsButton).toBeEnabled();
            await expect(page.getByText('Только просмотр', { exact: true })).toHaveCount(0);
            expect(publications(), 'Просмотр истории не создаёт публикаций').toBe(0);
        });
    },
);
