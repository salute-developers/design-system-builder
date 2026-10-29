import type { PendingProjectMember } from '../domain/project';

export type CreateProjectResult = {
    projectId: string;
    failedMembers: PendingProjectMember[];
};

export type CreateProjectRepository = {
    create: (input: { name: string; description?: string }) => Promise<{ id: string }>;
    addMember: (projectId: string, member: PendingProjectMember) => Promise<unknown>;
};

export const createProjectWithMembers = async (
    repository: CreateProjectRepository,
    {
        existingProjectId,
        name,
        description,
        members,
    }: {
        existingProjectId?: string;
        name: string;
        description?: string;
        members: PendingProjectMember[];
    },
): Promise<CreateProjectResult> => {
    const projectId =
        existingProjectId ||
        (
            await repository.create({
                name: name.trim(),
                description: description?.trim() || undefined,
            })
        ).id;
    const failedMembers: PendingProjectMember[] = [];
    for (const member of members) {
        try {
            await repository.addMember(projectId, member);
        } catch {
            failedMembers.push(member);
        }
    }
    return { projectId, failedMembers };
};
