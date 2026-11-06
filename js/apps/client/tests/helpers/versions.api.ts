import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

export type PublishedVersion = Readonly<{
    id: string;
    designSystemId: string;
    version: string;
    changelog: string;
}>;

/** Подготовка публикаций только внутри отдельной ДС текущего теста. */
export class VersionsApi {
    readonly createURL: string;
    private readonly systemURL: string;
    private readonly designSystemId: string;
    private readonly projectId: string;
    private readonly session: Session;

    constructor(gatewayBaseURL: string, projectId: string, designSystemId: string, session: Session) {
        const root = new URL(`api/projects/${encodeURIComponent(projectId)}/ds/`, gatewayBaseURL);
        this.createURL = new URL('design-system-versions', root).href;
        this.systemURL = new URL(`design-systems/${encodeURIComponent(designSystemId)}`, root).href;
        this.designSystemId = designSystemId;
        this.projectId = projectId;
        this.session = session;
    }

    async publish(version: string, changelog: string): Promise<PublishedVersion> {
        const current = await authenticatedRequest(this.session, this.systemURL, 'GET', [200]);
        const raw: unknown = await current.json();
        expect(raw, 'Свежий черновик собственной обычной ДС').toMatchObject({
            id: this.designSystemId,
            projectId: this.projectId,
            isTechnical: false,
            draftId: expect.stringMatching(/\S/u),
            draftRevision: expect.any(Number),
        });
        const { draftId, draftRevision } = raw as { draftId: string; draftRevision: number };
        expect(Number.isSafeInteger(draftRevision) && draftRevision >= 0).toBe(true);
        const response = await authenticatedRequest(
            this.session,
            this.createURL,
            'POST',
            [201],
            { designSystemId: this.designSystemId, draftId, draftRevision, version, changelog },
            randomUUID(),
        );
        const published: unknown = await response.json();
        expect(published, 'Создана публикация своей ДС с заданными метаданными').toMatchObject({
            id: expect.stringMatching(/\S/u),
            designSystemId: this.designSystemId,
            version,
            changelog,
        });
        return { id: (published as { id: string }).id, designSystemId: this.designSystemId, version, changelog };
    }

    async changes(): Promise<unknown[]> {
        const response = await authenticatedRequest(this.session, this.systemURL + '/changes', 'GET', [200]);
        const raw: unknown = await response.json();
        expect(Array.isArray(raw), 'Журнал своей ДС — массив').toBe(true);
        return raw as unknown[];
    }
}
