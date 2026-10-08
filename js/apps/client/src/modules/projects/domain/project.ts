export type ProjectRole = 'viewer' | 'editor' | 'maintainer' | 'owner';

export interface Project {
    id: string;
    name: string;
    description?: string | null;
    status: 'active' | 'archived';
    ownerUserId: string;
    ownerUsername?: string | null;
    ownerEmail?: string | null;
    ownerDisplayName?: string | null;
    effectiveRole: ProjectRole;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectMember {
    userId: string;
    username?: string | null;
    email?: string | null;
    displayName?: string | null;
    role: Exclude<ProjectRole, 'owner'>;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectMemberCandidate {
    userId: string;
    username?: string | null;
    email: string;
    displayName?: string | null;
}

export interface ProjectAccessKey {
    id: string;
    projectId: string;
    name: string;
    scopes: string[];
    createdByUserId: string;
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreatedProjectAccessKey {
    key: ProjectAccessKey;
    secret: string;
}

export type PendingProjectMember = { email: string; role: ProjectMember['role'] };
