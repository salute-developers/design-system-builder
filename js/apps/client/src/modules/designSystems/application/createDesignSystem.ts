import type { DesignSystem } from '../domain/designSystem';

export type CreateDesignSystemRepository = {
    create: (projectId: string, input: { name: string; projectName: string }) => Promise<DesignSystem>;
};

export const createDesignSystem = async (
    repository: CreateDesignSystemRepository,
    {
        projectId,
        projectName,
        name,
    }: {
        projectId: string;
        projectName: string;
        name: string;
    },
) => {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('Введите название Design System.');
    return repository.create(projectId, {
        name: normalizedName,
        projectName: projectName || normalizedName,
    });
};
