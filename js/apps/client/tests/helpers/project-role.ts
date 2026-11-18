import { expect } from '@playwright/test';
import type { Environment } from '../config/environment.ts';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';
import { prepareProject, requireOwnerProject } from './project.ts';

export type MemberRole = 'viewer' | 'editor';

/** Переиспользует отдельный собственный проект роли, не меняя чужое членство. */
export async function prepareRoleProject(
    environment: Environment,
    owner: Session,
    member: Session,
    username: string,
    role: MemberRole,
): Promise<{ id: string; name: string }> {
    expect(member.admin, 'Участник не должен быть system_admin').toBe(false);
    expect(member.subject, 'Для роли нужна отдельная учётная запись').not.toBe(owner.subject);
    const project = await prepareProject(
        { ...environment, projectName: environment.projectName + ' UI Roles ' + role },
        owner,
    );
    const url = new URL(`api/projects/${encodeURIComponent(project.id)}`, environment.gatewayBaseURL).href;
    const response = await authenticatedRequest(owner, url + '/members', 'GET', [200]);
    const members: unknown = await response.json();
    expect(Array.isArray(members), 'Список участников проекта').toBe(true);
    const existing = (members as { userId: string; role: string }[]).filter((item) => item.userId === member.subject);
    expect(existing.length, 'Единственное членство проверяемого участника').toBeLessThanOrEqual(1);
    if (!existing.length) {
        await requireOwnerProject(environment.gatewayBaseURL, project.id, owner);
        const added = await authenticatedRequest(owner, url + '/members', 'POST', [201], { email: username, role });
        const identity: unknown = await added.json();
        expect(identity, 'Добавлена именно тестовая учётная запись').toMatchObject({ userId: member.subject });
    }
    const access = await authenticatedRequest(member, url, 'GET', [200]);
    expect(await access.json(), 'Реальные права браузерной сессии').toMatchObject({
        id: project.id,
        status: 'active',
        effectiveRole: role,
        ownerUserId: owner.subject,
    });
    return { id: project.id, name: project.name };
}
