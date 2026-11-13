import { http } from './http';
import { apiRoot, readRequest } from './editorHttp';
import { invalidateEditorReads } from './editorReads';
import type { EditorContextKey, ComponentPropertyDto } from './editorContracts';

export interface CoreRelease {
    releaseId: string;
    libraryId: string;
    platform: string;
    version: string;
    metaSha256: string | null;
    provenance: string;
}
export interface CoreIssue {
    issueId: string;
    code: string;
    severity: 'blocking' | 'warning';
    location: {
        componentId: string;
        componentName: string;
        platform: 'web' | 'compose' | 'xml' | 'ios';
        appearanceId: string | null;
        appearanceName: string | null;
        propertyId: string | null;
        propertyName: string | null;
        valueKind: string | null;
        valueId: string | null;
        styleIds: string[];
        styleLabels: string[];
        states: string[];
        revision: number | null;
    };
    storedValue: {
        literal: string | null;
        tokenId: string | null;
        tokenName: string | null;
        alpha: string | null;
        adjustment: string | null;
        targetAppearanceId: string | null;
        targetStyleIds: string[];
        platformAdjustments: Array<{
            id: string;
            platformParamId: string;
            revision: number | null;
            value: string | null;
            template: string | null;
        }>;
    } | null;
    allowedActions: string[];
}
export interface CoreCompatibilityReport {
    context: {
        designSystemId: string;
        versionId: string | null;
        draftId: string | null;
        draftRevision: number | null;
        coreReleases: CoreRelease[];
    };
    items: CoreIssue[];
    blockingCount: number;
    warningCount: number;
    validatorVersion: number;
    nextCursor: string | null;
}

export const coreCompatibilityRepository = {
    async read(
        context: EditorContextKey,
        componentId?: string,
        signal?: AbortSignal,
    ): Promise<CoreCompatibilityReport> {
        const root = apiRoot(context.projectId, context.designSystemId);
        const request = readRequest(context, signal);
        const first = await http.get<CoreCompatibilityReport>(`${root}/compatibility`, {
            ...request,
            params: { ...request.params, componentId, limit: 200 },
        });
        const report = { ...first.data, items: [...first.data.items] };
        while (report.nextCursor) {
            const next = await http.get<CoreCompatibilityReport>(`${root}/compatibility`, {
                ...request,
                params: { ...request.params, componentId, limit: 200, cursor: report.nextCursor },
            });
            report.items.push(...next.data.items);
            report.nextCursor = next.data.nextCursor;
        }
        return report;
    },
    async targets(context: EditorContextKey, componentId: string): Promise<ComponentPropertyDto[]> {
        return (
            await http.get<ComponentPropertyDto[]>(
                `${apiRoot(context.projectId, context.designSystemId)}/components/${componentId}/properties`,
                readRequest(context),
            )
        ).data;
    },
    async repair(
        context: EditorContextKey,
        issue: CoreIssue,
        targetPropertyId?: string,
        draftRevision?: number | null,
    ): Promise<void> {
        const l = issue.location;
        await http.post(
            `${apiRoot(context.projectId, context.designSystemId)}/compatibility/repair`,
            {
                appearanceId: l.appearanceId,
                valueKind: l.valueKind,
                valueId: l.valueId,
                expectedRevision: l.revision ?? 0,
                ...(targetPropertyId ? { targetPropertyId } : {}),
            },
            {
                ...readRequest(context),
                headers: {
                    'Idempotency-Key': crypto.randomUUID(),
                    ...(draftRevision != null ? { 'X-DS-Base-Revision': String(draftRevision) } : {}),
                },
            },
        );
        invalidateEditorReads(context);
    },
};
