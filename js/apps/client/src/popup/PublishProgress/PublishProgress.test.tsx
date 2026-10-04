import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Config, DesignSystem, Theme } from '../../controllers';

const operations = vi.hoisted(() => ({
    designSystemSave: vi.fn(),
    generatePublish: vi.fn(),
    longPollNpm: vi.fn(),
    generateAndDeployDocumentation: vi.fn(),
    clearDraft: vi.fn(),
}));
vi.mock('../../pages', () => ({
    designSystemSave: operations.designSystemSave,
    generatePublish: operations.generatePublish,
    longPollNpm: operations.longPollNpm,
    generateAndDeployDocumentation: operations.generateAndDeployDocumentation,
}));
vi.mock('../../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    clearDraft: operations.clearDraft,
}));

import { PublishProgress } from './PublishProgress';

describe('tenant-aware publication', () => {
    it('does not publish or clear the draft when saving the active tenant fails', async () => {
        operations.designSystemSave.mockRejectedValueOnce(new Error('TENANT_EDIT_CONFLICT'));
        const designSystem = {
            getParameters: () => ({
                projectName: 'DS',
                packagesName: 'ds',
                accentColor: 'blue',
                darkFillSaturation: 50,
            }),
            getName: () => 'DS',
            getVersion: () => '0.1.0',
        } as unknown as DesignSystem;
        render(
            <PublishProgress
                designSystem={designSystem}
                theme={{} as Theme}
                components={[] as Config[]}
                onPrevPage={() => {}}
                onNextPage={() => {}}
            />,
        );
        expect(await screen.findByText(/Публикация не запущена/)).toBeInTheDocument();
        await waitFor(() => expect(operations.designSystemSave).toHaveBeenCalledOnce());
        expect(operations.generatePublish).not.toHaveBeenCalled();
        expect(operations.clearDraft).not.toHaveBeenCalled();
    });
});
