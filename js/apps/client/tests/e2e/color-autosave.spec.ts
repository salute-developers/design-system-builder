import { test, expect } from '../fixtures/colors.ts';

test(
    'PLASMABLDR-T784: CT-047 Автосохранение токена и изоляция соседнего',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T784' } },
    async ({ colors, colorData, initialTheme, tokenValues, colorSteps }) => {
        await colors.open();
        await colors.token('textPromoMinor').click();
        await expect(colors.light).toHaveValue('FFFFFF');
        await colors.token('textAccent').click();
        await expect(colors.light).toHaveValue('171717');
        await expect(colors.dark).toHaveValue('F5F5F5');
        await expect(colors.inspector.getByRole('button', { name: 'Связь с Modes включена', exact: true })).toHaveCount(
            3,
        );

        await test.step('Сохранить Light через UI и подтвердить индикатор за 10 секунд', async () => {
            const response = await colorSteps.saveLight(
                '#3366CC',
                tokenValues.colorURL(initialTheme.id, colorData.accent.id),
            );
            const body: unknown = response.request().postDataJSON();
            expect(body).toMatchObject({ members: expect.any(Array) });
            const ids = (body as { members: { tokenId: string }[] }).members.map((member) => member.tokenId);
            const expectedMembers = colorData.family.filter((member) => !member.name.includes('.on-dark.'));
            expect([...ids].sort(), 'Только изменённые контексты и состояния семейства textAccent').toEqual(
                expectedMembers.map((member) => member.id).sort(),
            );
            expect(ids).not.toContain(colorData.neighbor.id);
        });

        await test.step('Две повторные загрузки подтверждают сохранение A и изоляцию B', async () => {
            await colors.reload();
            await colors.token('textAccent').click();
            await expect(colors.light).toHaveValue('3366CC');
            await expect(colors.dark).toHaveValue('F5F5F5');
            await colors.reload();
            await colors.token('textPromoMinor').click();
            await expect(colors.light).toHaveValue('FFFFFF');
        });
    },
);
