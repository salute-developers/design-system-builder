import { test as base, expect } from './test.ts';
import { readEnvironment } from '../config/environment.ts';
import type { Environment } from '../config/environment.ts';
import { authenticate } from '../helpers/authentication.ts';
import type { Session } from '../helpers/authentication.ts';
import { prepareRoleProject } from '../helpers/project-role.ts';
import type { MemberRole } from '../helpers/project-role.ts';
import { sessionFixtureTimeoutMs, resourceFixtureTimeoutMs } from '../config/timeouts.ts';
import { ProjectAccessPage } from '../pages/project-access.page.ts';

type Fixtures = {
    memberRole: MemberRole;
    memberEnvironment: Environment;
    memberSession: Session;
    roleProject: { id: string; name: string };
    projectAccess: ProjectAccessPage;
};

export const test = base.extend<Fixtures>({
    memberRole: ['viewer', { option: true }],
    memberEnvironment: async ({}, use) => {
        await use(await readEnvironment(process.env, 'member'));
    },
    memberSession: [
        async ({ environment, memberEnvironment }, use) => {
            const session = await authenticate({ ...environment, credentials: memberEnvironment.credentials });
            try {
                await use(session);
            } finally {
                await session.close();
            }
        },
        { timeout: sessionFixtureTimeoutMs },
    ],
    roleProject: [
        async ({ environment, session, memberEnvironment, memberSession, memberRole }, use, info) => {
            const project = await test.step('Подготовить собственный проект и подтвердить роль участника', () =>
                prepareRoleProject(
                    environment,
                    session,
                    memberSession,
                    memberEnvironment.credentials.username,
                    memberRole,
                ));
            info.annotations.push({ type: 'e2e-project', description: project.id });
            await use(project);
        },
        { timeout: resourceFixtureTimeoutMs },
    ],
    storageState: async ({ memberSession, roleProject }, use) => {
        expect(roleProject.id).not.toBe('');
        await use(memberSession.storageState);
    },
    projectAccess: async ({ page, environment, roleProject }, use) => {
        await use(new ProjectAccessPage(page, environment.clientBaseURL, roleProject.id));
    },
});

export { expect };
