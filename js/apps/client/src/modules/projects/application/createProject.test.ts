import { describe, expect, it, vi } from 'vitest';

import { createProjectWithMembers } from './createProject';

describe('createProjectWithMembers', () => {
    it('keeps failed member assignments retryable after the project is created', async () => {
        const failed = { email: 'failed@example.com', role: 'viewer' as const };
        const repository = {
            create: vi.fn().mockResolvedValue({ id: 'project-1' }),
            addMember: vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('lookup failed')),
        };
        const result = await createProjectWithMembers(repository, {
            name: ' Platform ',
            description: ' Shared ',
            members: [{ email: 'ok@example.com', role: 'editor' }, failed],
        });
        expect(repository.create).toHaveBeenCalledWith({ name: 'Platform', description: 'Shared' });
        expect(result).toEqual({ projectId: 'project-1', failedMembers: [failed] });
    });
});
