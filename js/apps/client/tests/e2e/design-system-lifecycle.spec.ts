import { expect, test } from '../fixtures/test.ts';

test('Owner создаёт дизайн-систему, повторно открывает и удаляет её', async ({
    page,
    systems,
    steps,
    systemsApi,
    systemData,
}) => {
    const created = await steps.create();
    const expected = { id: created.id, name: systemData.name, projectId: systemData.projectId };

    await expect(page).toHaveURL(systems.systemURL(created.id));
    await expect(systems.systemTitle(created.name)).toBeVisible();
    await expect(systems.emptyThemes).toBeVisible();

    await test.step('Независимый GET подтверждает сохранение системы', async () => {
        expect(await systemsApi.get(created.id)).toMatchObject(expected);
    });

    expect(await steps.reload(created.id)).toMatchObject(expected);
    await expect(page).toHaveURL(systems.systemURL(created.id));
    await expect(systems.systemTitle(created.name)).toBeVisible();
    await expect(systems.emptyThemes).toBeVisible();

    await steps.reopen(created.name);
    await expect(page).toHaveURL(systems.systemURL(created.id));
    await expect(systems.systemTitle(created.name)).toBeVisible();
    await expect(systems.emptyThemes).toBeVisible();
});
