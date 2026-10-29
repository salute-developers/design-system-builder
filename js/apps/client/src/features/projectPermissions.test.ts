import { describe, expect, it } from 'vitest';
import { can, type ProjectPermission } from './projectPermissions';
import type { ProjectRole } from '../api/contracts';

const permissions: ProjectPermission[] = [
    'project:update',
    'project:archive',
    'members:manage',
    'designSystems:write',
    'designSystems:delete',
    'tenants:write',
    'tenants:delete',
];

describe('project permissions', () => {
    const expected: Record<ProjectRole, ProjectPermission[]> = {
        viewer: [],
        editor: ['tenants:write'],
        maintainer: [
            'project:update',
            'members:manage',
            'designSystems:write',
            'designSystems:delete',
            'tenants:write',
            'tenants:delete',
        ],
        owner: permissions,
    };

    for (const role of Object.keys(expected) as ProjectRole[]) {
        it(`maps ${role} to canonical grants`, () => {
            expect(permissions.filter((permission) => can(role, permission))).toEqual(expected[role]);
        });
    }
});
