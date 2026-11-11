import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

export type ThemeIdentity = Readonly<{ id: string; designSystemId: string; name: string }>;

/** Только подготовка и независимые чтения тем внутри собственной ДС. */
export class ThemesApi {
    readonly createURL: string;
    readonly listURL: string;
    private readonly designSystemId: string;
    private readonly session: Session;

    constructor(gatewayBaseURL: string, projectId: string, designSystemId: string, session: Session) {
        const root = `api/projects/${encodeURIComponent(projectId)}/ds/`;
        this.createURL = new URL(root + 'tenants', gatewayBaseURL).href;
        this.listURL = new URL(
            root + `design-systems/${encodeURIComponent(designSystemId)}/tenants`,
            gatewayBaseURL,
        ).href;
        this.designSystemId = designSystemId;
        this.session = session;
    }

    detailURL(id: string): string {
        return this.createURL + '/' + encodeURIComponent(id);
    }

    private identity(raw: unknown): ThemeIdentity {
        expect(raw, 'Тема принадлежит подготовленной ДС').toMatchObject({
            id: expect.stringMatching(/\S/u),
            designSystemId: this.designSystemId,
            name: expect.stringMatching(/\S/u),
        });
        const { id, designSystemId, name } = raw as ThemeIdentity;
        return { id, designSystemId, name };
    }

    async create(name: string): Promise<ThemeIdentity> {
        const response = await authenticatedRequest(this.session, this.createURL, 'POST', [201], {
            designSystemId: this.designSystemId,
            name,
            profile: 'malachite',
        });
        return this.identity(await response.json());
    }

    async rename(id: string, name: string): Promise<ThemeIdentity> {
        const response = await authenticatedRequest(this.session, this.detailURL(id), 'PATCH', [200], { name });
        const theme = this.identity(await response.json());
        expect(theme).toMatchObject({ id, name });
        return theme;
    }

    async list(): Promise<ThemeIdentity[]> {
        const response = await authenticatedRequest(this.session, this.listURL, 'GET', [200]);
        const raw: unknown = await response.json();
        expect(Array.isArray(raw), 'Список тем').toBe(true);
        return (raw as unknown[]).map((value) => this.identity(value));
    }

    async get(id: string): Promise<unknown> {
        const response = await authenticatedRequest(this.session, this.detailURL(id), 'GET', [200]);
        const raw: unknown = await response.json();
        expect(this.identity(raw).id).toBe(id);
        return raw;
    }
}
