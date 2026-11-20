import { expect } from '@playwright/test';
import type { Environment } from '../config/environment.ts';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

type Project = Readonly<{ id: string; name: string; status: string; ownerUserId: string; effectiveRole: string }>;

function project(value: unknown): Project {
    const data = value as Project | null;
    const result = {
        id: data?.id,
        name: data?.name,
        status: data?.status,
        ownerUserId: data?.ownerUserId,
        effectiveRole: data?.effectiveRole,
    };
    expect(result, 'DTO проекта').toMatchObject({
        id: expect.stringMatching(/\S/u),
        name: expect.stringMatching(/\S/u),
        status: expect.stringMatching(/\S/u),
        ownerUserId: expect.stringMatching(/\S/u),
        effectiveRole: expect.stringMatching(/\S/u),
    });
    return result as Project;
}

/** Защищённый GET подтверждает актуальные права перед UI и cleanup. */
export async function requireOwnerProject(gatewayBaseURL: string, id: string, session: Session): Promise<Project> {
    expect(session.admin, 'Пилот требует обычного Owner без system_admin').toBe(false);
    const url = new URL(`api/projects/${encodeURIComponent(id)}`, gatewayBaseURL).href;
    const response = await authenticatedRequest(session, url, 'GET', [200]);
    const current = project(await response.json());
    expect(current, 'Защищённый GET должен подтверждать выбранный active-проект своего Owner').toMatchObject({
        id,
        status: 'active',
        effectiveRole: 'owner',
        ownerUserId: session.subject,
    });
    return current;
}

/** Переиспользует только собственный выделенный проект; при отсутствии создаёт один раз. */
export async function prepareProject(environment: Environment, session: Session): Promise<Project> {
    expect(session.admin, 'Пилот требует обычного Owner без system_admin').toBe(false);
    const url = new URL('api/projects', environment.gatewayBaseURL).href;
    const response = await authenticatedRequest(session, url, 'GET', [200]);
    const raw: unknown = await response.json();
    expect(Array.isArray(raw), 'Список проектов должен быть массивом').toBe(true);
    const matches = (raw as unknown[])
        .map(project)
        .filter(
            (value) =>
                value.name === environment.projectName &&
                value.status === 'active' &&
                value.ownerUserId === session.subject &&
                value.effectiveRole === 'owner',
        );
    expect(
        matches.length,
        'Найдено несколько собственных active E2E-проектов; устраните дубликаты или задайте DSB_E2E_PROJECT_NAME',
    ).toBeLessThanOrEqual(1);
    let id = matches[0]?.id;
    if (!id) {
        const created = await authenticatedRequest(session, url, 'POST', [201], {
            name: environment.projectName,
            description: 'Выделенный проект UI E2E; переиспользуется между запусками.',
        });
        // POST DTO не содержит effectiveRole: права подтверждаются только свежим GET.
        const rawCreated: unknown = await created.json();
        const createdId = (rawCreated as { id?: string } | null)?.id;
        expect(createdId, 'Ответ создания проекта должен содержать пригодный ID; POST не повторяется').toEqual(
            expect.stringMatching(/\S/u),
        );
        id = createdId as string;
    }
    const confirmed = await requireOwnerProject(environment.gatewayBaseURL, id, session);
    expect(confirmed.name, 'Имя E2E-проекта не должно меняться во время подготовки').toBe(environment.projectName);
    return confirmed;
}
