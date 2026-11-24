import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { prepareRoleProject, type MemberRole } from './project-role.ts';
import type { Environment } from '../config/environment.ts';
import type { Session } from './authentication.ts';

const owner = { accessToken: 'unit-owner', subject: 'owner-user', admin: false } as Session;
const member = { accessToken: 'unit-member', subject: 'member-user', admin: false } as Session;
const environment: Environment = {
    clientBaseURL: 'http://localhost:4173/',
    gatewayBaseURL: 'http://localhost/',
    clientId: 'unit-client',
    projectName: 'Unit E2E',
    credentials: { username: 'owner@example.test', password: 'unused' },
};

type Options = { loseOwnership?: boolean; wrongEffectiveRole?: boolean; rejectPatch?: boolean };

function backend(context: TestContext, requested: MemberRole, initial: MemberRole | undefined, options: Options = {}) {
    let currentRole = initial;
    let ownerReads = 0;
    let memberReads = 0;
    const writes: { method: string; path: string; body: unknown }[] = [];
    const project = {
        id: 'own-project',
        name: environment.projectName + ' UI Roles ' + requested,
        status: 'active',
        ownerUserId: owner.subject,
        effectiveRole: 'owner',
    };
    const projectPath = '/api/projects/' + project.id;
    context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
        const method = init?.method;
        const authorization = new Headers(init?.headers).get('Authorization');
        if (method === 'GET' && path === '/api/projects') return Response.json([project]);
        if (method === 'GET' && path === projectPath) {
            if (authorization === 'Bearer unit-member') {
                memberReads++;
                return Response.json({ ...project, effectiveRole: options.wrongEffectiveRole ? initial : currentRole });
            }
            ownerReads++;
            return Response.json({
                ...project,
                ownerUserId: options.loseOwnership && ownerReads > 1 ? 'someone-else' : owner.subject,
            });
        }
        if (method === 'GET' && path === projectPath + '/members') {
            return Response.json([
                { userId: 'unrelated-user', role: 'editor' },
                ...(currentRole ? [{ userId: member.subject, role: currentRole }] : []),
            ]);
        }
        if (method === 'POST' || method === 'PATCH') {
            assert.equal(authorization, 'Bearer unit-owner');
            assert.equal(ownerReads, 2, 'Fresh ownership must be confirmed before writing');
            assert.equal(path, projectPath + '/members' + (method === 'PATCH' ? '/' + member.subject : ''));
            const body = JSON.parse(String(init?.body));
            writes.push({ method, path, body });
            if (method === 'PATCH' && options.rejectPatch) return Response.json({}, { status: 403 });
            currentRole = body.role;
            return Response.json(
                { userId: member.subject, role: currentRole },
                { status: method === 'POST' ? 201 : 200 },
            );
        }
        throw new Error('Unexpected request in unit fixture');
    });
    return { writes, memberReads: () => memberReads };
}

for (const role of ['viewer', 'editor'] as const) {
    test('Matching ' + role + ' membership is reused without writes', async (context) => {
        const state = backend(context, role, role);
        await prepareRoleProject(environment, owner, member, 'member@example.test', role);
        assert.deepEqual(state.writes, []);
        assert.equal(state.memberReads(), 1);
    });
    test('Wrong membership is restored to ' + role + ' only for the test member', async (context) => {
        const state = backend(context, role, role === 'viewer' ? 'editor' : 'viewer');
        await prepareRoleProject(environment, owner, member, 'member@example.test', role);
        assert.deepEqual(state.writes, [
            { method: 'PATCH', path: '/api/projects/own-project/members/member-user', body: { role } },
        ]);
        assert.equal(state.memberReads(), 1);
    });
}

test('Missing test member is added once', async (context) => {
    const state = backend(context, 'viewer', undefined);
    await prepareRoleProject(environment, owner, member, 'member@example.test', 'viewer');
    assert.deepEqual(state.writes, [
        {
            method: 'POST',
            path: '/api/projects/own-project/members',
            body: { email: 'member@example.test', role: 'viewer' },
        },
    ]);
});

test('Changed project ownership prevents role repair', async (context) => {
    const state = backend(context, 'viewer', 'editor', { loseOwnership: true });
    await assert.rejects(() => prepareRoleProject(environment, owner, member, 'member@example.test', 'viewer'));
    assert.deepEqual(state.writes, []);
});

test('Effective member role is still checked after a successful PATCH', async (context) => {
    const state = backend(context, 'editor', 'viewer', { wrongEffectiveRole: true });
    await assert.rejects(() => prepareRoleProject(environment, owner, member, 'member@example.test', 'editor'));
    assert.equal(state.writes.length, 1);
    assert.equal(state.memberReads(), 1);
});

test('Rejected role PATCH fails without retry', async (context) => {
    const state = backend(context, 'viewer', 'editor', { rejectPatch: true });
    await assert.rejects(
        () => prepareRoleProject(environment, owner, member, 'member@example.test', 'viewer'),
        /HTTP 403/u,
    );
    assert.equal(state.writes.length, 1);
    assert.equal(state.memberReads(), 0);
});
