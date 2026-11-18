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
        this.systemURL = new URL(
            `api/projects/${encodeURIComponent(projectId)}/design-systems/${encodeURIComponent(designSystemId)}`,
            gatewayBaseURL,
        ).href;
        this.createURL = this.systemURL + '/versions';
        this.designSystemId = designSystemId;
        this.projectId = projectId;
        this.session = session;
    }

    revertURL(changeId: string): string {
        return this.systemURL + '/changes/' + encodeURIComponent(changeId) + '/revert';
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
            { draftId, draftRevision, version, changelog },
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

    addressedRevertURL(): string {
        return this.systemURL + '/changes/revert-by-address';
    }

    async changesCount(): Promise<number> {
        // Техническое чтение подготовки: одна попытка до 30s вместо двух обрываемых на 10s запросов.
        const response = await authenticatedRequest(
            this.session,
            this.systemURL + '/changes/summary',
            'GET',
            [200],
            undefined,
            undefined,
            { timeoutMs: 30_000, attempts: 1 },
        );
        const raw: unknown = await response.json();
        expect(raw, 'Сводка журнала своей ДС').toMatchObject({ total: expect.any(Number) });
        const { total } = raw as { total: number };
        expect(Number.isSafeInteger(total) && total >= 0, 'Число изменений — неотрицательное целое').toBe(true);
        return total;
    }

    async changes(): Promise<unknown[]> {
        const response = await authenticatedRequest(this.session, this.systemURL + '/changes', 'GET', [200]);
        const raw: unknown = await response.json();
        expect(Array.isArray(raw), 'Журнал своей ДС — массив').toBe(true);
        return raw as unknown[];
    }
}
