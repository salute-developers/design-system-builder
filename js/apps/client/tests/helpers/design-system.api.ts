import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';
import { requireOwnerProject } from './project.ts';

export type DesignSystem = Readonly<{
    id: string;
    name: string;
    projectId: string | null;
    description: string | null;
    isTechnical: boolean;
    tenantCount: number;
}>;

export function designSystem(value: unknown): DesignSystem {
    const identity = value as DesignSystem | null;
    expect({ id: identity?.id, name: identity?.name }, 'DTO дизайн-системы').toMatchObject({
        id: expect.stringMatching(/\S/u),
        name: expect.stringMatching(/\S/u),
    });
    const { id, name, projectId, description = null, isTechnical = false, tenantCount } = value as DesignSystem;
    if (projectId !== null) expect(projectId, 'projectId системы').toEqual(expect.stringMatching(/\S/u));
    if (description !== null) expect(typeof description, 'description системы').toBe('string');
    expect(typeof isTechnical, 'isTechnical системы').toBe('boolean');
    expect(Number.isInteger(tenantCount), 'tenantCount должен быть целым числом').toBe(true);
    expect(tenantCount, 'tenantCount системы').toBeGreaterThanOrEqual(0);
    return { id, name, projectId, description, isTechnical, tenantCount };
}
export function baselineView(systems: readonly DesignSystem[]): DesignSystem[] {
    return [...systems].sort((left, right) => left.id.localeCompare(right.id));
}

/** Только предметные операции пилота, без подготовки проекта и управления ресурсами. */
export class DesignSystemApi {
    private readonly gatewayBaseURL: string;
    readonly projectId: string;
    private readonly session: Session;
    constructor(gatewayBaseURL: string, projectId: string, session: Session) {
        this.gatewayBaseURL = gatewayBaseURL;
        this.projectId = projectId;
        this.session = session;
    }

    url(suffix = ''): string {
        return new URL(
            `api/projects/${encodeURIComponent(this.projectId)}/ds/design-systems${suffix}`,
            this.gatewayBaseURL,
        ).href;
    }
    requireOwner() {
        return requireOwnerProject(this.gatewayBaseURL, this.projectId, this.session);
    }
    async list(): Promise<DesignSystem[]> {
        const response = await authenticatedRequest(this.session, this.url(), 'GET', [200]);
        const raw: unknown = await response.json();
        expect(Array.isArray(raw), 'Каталог дизайн-систем должен быть массивом').toBe(true);
        const systems = (raw as unknown[]).map(designSystem);
        expect(new Set(systems.map((system) => system.id)).size, 'ID систем не должны повторяться').toBe(
            systems.length,
        );
        return systems;
    }
    async get(id: string): Promise<DesignSystem | null> {
        const response = await authenticatedRequest(
            this.session,
            this.url('/' + encodeURIComponent(id)),
            'GET',
            [200, 404],
        );
        if (response.status === 404) {
            await response.body?.cancel();
            return null;
        }
        return designSystem(await response.json());
    }
    async remove(id: string): Promise<void> {
        const response = await authenticatedRequest(
            this.session,
            this.url('/' + encodeURIComponent(id)),
            'DELETE',
            [200],
        );
        await response.body?.cancel();
    }
}
