import { describe, expect, it, vi } from 'vitest';

import { runStructureOperation } from './runStructureOperation';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };

describe('runStructureOperation', () => {
    it('перечитывает компонент по маршруту с платформой и открывает созданную конфигурацию', async () => {
        const reload = vi.fn(async () => undefined);
        const open = vi.fn();

        await runStructureOperation(async () => 'created', context, 'compose-Button', reload, open);

        expect(reload).toHaveBeenCalledWith('compose-Button');
        expect(open).toHaveBeenCalledWith('created');
    });

    it('перечитывает компонент и после ошибки, ошибку пробрасывает', async () => {
        const reload = vi.fn(async () => undefined);
        const open = vi.fn();
        const failure = new Error('второе удаление не прошло');

        await expect(
            runStructureOperation(
                async () => {
                    throw failure;
                },
                context,
                'Chip',
                reload,
                open,
            ),
        ).rejects.toBe(failure);

        expect(reload).toHaveBeenCalledWith('Chip');
        expect(open).not.toHaveBeenCalled();
    });
});
