import { describe, expect, it, vi } from 'vitest';

import { createDesignSystem } from './createDesignSystem';

describe('createDesignSystem', () => {
    it('validates and normalizes input before calling the repository port', async () => {
        const repository = {
            create: vi.fn().mockResolvedValue({ id: 'ds-1' }),
        };
        await createDesignSystem(repository as never, {
            projectId: 'project-1',
            projectName: 'Platform',
            name: ' System ',
        });
        expect(repository.create).toHaveBeenCalledWith('project-1', {
            name: 'System',
            projectName: 'Platform',
        });
        await expect(
            createDesignSystem(repository as never, {
                projectId: 'project-1',
                projectName: 'Platform',
                name: ' ',
            }),
        ).rejects.toThrow('Введите название Design System.');
    });
});
