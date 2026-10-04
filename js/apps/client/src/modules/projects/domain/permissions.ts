import type { ProjectRole } from './project';

export type ProjectPermission =
    | 'project:update'
    | 'project:archive'
    | 'members:manage'
    | 'designSystems:write'
    | 'designSystems:delete'
    | 'tenants:write'
    | 'tenants:delete';

const grants: Record<ProjectRole, ReadonlySet<ProjectPermission>> = {
    viewer: new Set(),
    editor: new Set(['tenants:write']),
    maintainer: new Set([
        'project:update',
        'members:manage',
        'designSystems:write',
        'designSystems:delete',
        'tenants:write',
        'tenants:delete',
    ]),
    owner: new Set([
        'project:update',
        'project:archive',
        'members:manage',
        'designSystems:write',
        'designSystems:delete',
        'tenants:write',
        'tenants:delete',
    ]),
};

export const can = (role: ProjectRole, permission: ProjectPermission): boolean => grants[role].has(permission);
