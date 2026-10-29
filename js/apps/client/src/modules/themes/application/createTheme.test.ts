import { describe, expect, it, vi } from 'vitest';

import { createTheme } from './createTheme';

describe('createTheme', () => {
    it('maps a custom palette through the repository port', async () => {
        const repository = {
            createTenant: vi.fn().mockResolvedValue({ id: 'theme-1' }),
        };
        await createTheme(repository as never, {
            projectId: 'project-1',
            designSystemId: 'ds-1',
            rawName: ' Brand ',
            profile: 'custom',
            palette: ['#111111', '#222222', '#333333', '#444444'],
        });
        expect(repository.createTenant).toHaveBeenCalledWith('project-1', {
            designSystemId: 'ds-1',
            name: 'Brand',
            profile: 'custom',
            customPalette: {
                primary: '#111111',
                onPrimary: '#222222',
                background: '#333333',
                text: '#444444',
            },
        });
    });
});
