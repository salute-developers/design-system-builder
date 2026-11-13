import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

export type TokenDefinition = Readonly<{ id: string; designSystemId: string; name: string; type: string }>;
export type TokenValue = Readonly<{
    tokenId: string;
    tenantId: string;
    platform: 'web' | 'ios' | 'android';
    mode: 'light' | 'dark' | null;
    value: unknown;
    editRevision: number;
    overridden?: boolean;
}>;

/** Публичная подготовка значений только внутри отдельной ДС текущего теста. */
export class TokenValuesApi {
    private readonly root: URL;
    private readonly systemId: string;
    private readonly session: Session;

    constructor(gatewayBaseURL: string, projectId: string, systemId: string, session: Session) {
        this.root = new URL(`api/projects/${encodeURIComponent(projectId)}/ds/`, gatewayBaseURL);
        this.systemId = systemId;
        this.session = session;
    }

    async definitions(): Promise<TokenDefinition[]> {
        const url = new URL(`design-systems/${encodeURIComponent(this.systemId)}/tokens`, this.root).href;
        const raw: unknown = await (await authenticatedRequest(this.session, url, 'GET', [200])).json();
        expect(Array.isArray(raw), 'Определения собственной ДС').toBe(true);
        for (const item of raw as unknown[]) {
            expect(item).toMatchObject({
                id: expect.any(String),
                designSystemId: this.systemId,
                name: expect.any(String),
                type: expect.any(String),
            });
        }
        return raw as TokenDefinition[];
    }

    valuesURL(themeId: string, types: string): string {
        const url = new URL(`tenants/${encodeURIComponent(themeId)}/token-values`, this.root);
        url.searchParams.set('types', types);
        return url.href;
    }

    colorURL(themeId: string, tokenId: string): string {
        return new URL(
            `tenants/${encodeURIComponent(themeId)}/color-tokens/${encodeURIComponent(tokenId)}/values`,
            this.root,
        ).href;
    }

    sizeURL(themeId: string, tokenId: string): string {
        return new URL(
            `tenants/${encodeURIComponent(themeId)}/size-tokens/${encodeURIComponent(tokenId)}/value`,
            this.root,
        ).href;
    }

    typographyStyleURL(themeId: string, tokenId: string): string {
        return new URL(
            `tenants/${encodeURIComponent(themeId)}/typography-styles/${encodeURIComponent(tokenId)}`,
            this.root,
        ).href;
    }

    async values(themeId: string, types: string): Promise<TokenValue[]> {
        const raw: unknown = await (
            await authenticatedRequest(this.session, this.valuesURL(themeId, types), 'GET', [200])
        ).json();
        expect(Array.isArray(raw), 'Значения подготовленной темы').toBe(true);
        for (const item of raw as unknown[]) {
            expect(item).toMatchObject({
                tokenId: expect.any(String),
                tenantId: themeId,
                editRevision: expect.any(Number),
            });
        }
        return raw as TokenValue[];
    }

    async seed(themeId: string, updates: readonly { current: TokenValue; value: unknown }[]): Promise<void> {
        expect(updates.length, 'Подготовка не должна быть пустой').toBeGreaterThan(0);
        const values = updates.map(({ current, value }) => {
            expect(current.tenantId).toBe(themeId);
            return {
                tokenId: current.tokenId,
                platform: current.platform,
                mode: current.mode,
                paletteId: null,
                value,
                baseRevision: current.editRevision,
            };
        });
        const url = new URL(`tenants/${encodeURIComponent(themeId)}/token-values`, this.root).href;
        const response = await authenticatedRequest(this.session, url, 'PUT', [200], { editRevision: 0, values });
        await response.arrayBuffer();
    }
}
