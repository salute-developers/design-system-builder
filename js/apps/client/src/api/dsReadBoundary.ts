import type { EditorContextKey } from './editorContracts';

/** Фактический режим и опубликованная граница адресного просмотра; не является разрешением на сервере. */
export type DsReadBoundary = {
    designSystemId: string;
    version?: string;
    versionId?: string;
    accessMode?: 'project' | 'public';
};
const boundaries = new Map<string, DsReadBoundary>();
export const readBoundaryForRoot = (root: string) => boundaries.get(root);
export const rememberDsReadBoundary = (root: string, boundary: DsReadBoundary) => boundaries.set(root, boundary);
export const clearDsReadBoundaries = () => boundaries.clear();
export const getDsReadBoundary = (projectId: string, designSystemId: string) =>
    readBoundaryForRoot(`/api/projects/${projectId}/design-systems/${designSystemId}`);
export const isPublicDsRead = (context: Pick<EditorContextKey, 'projectId' | 'designSystemId'>) =>
    getDsReadBoundary(context.projectId, context.designSystemId)?.accessMode === 'public';

interface BoundaryResponseRequest {
    root?: string;
    pathname: string;
    params?: Record<string, unknown>;
    locationAtRequest: string;
    current: boolean;
}

/** Проверяет ответ до записи границы; старый экран не меняет контекст текущего просмотра. */
export const receiveDsReadBoundary = (request: BoundaryResponseRequest, raw: unknown) => {
    if (!request.root || typeof raw !== 'string') return;
    const actual = JSON.parse(raw) as DsReadBoundary;
    const expectedId = request.root.split('/').slice(-1)[0];
    if (actual?.designSystemId !== expectedId) throw new Error('DS_READ_CONTEXT_MISMATCH');
    const rootRead = request.pathname === request.root;
    const missingPublication = [actual.accessMode === 'public', rootRead, !actual.versionId].every(Boolean);
    if (missingPublication) {
        throw new Error('DS_READ_CONTEXT_MISSING_PUBLICATION');
    }
    const selected = request.params ?? {};
    const selectors: Array<'versionId' | 'version'> = ['versionId', 'version'];
    const matches = selectors.every((name) => selected[name] === undefined || actual[name] === selected[name]);
    if (!matches) throw new Error('DS_READ_CONTEXT_MISMATCH');
    const stillCurrent = [rootRead, request.current, window.location.href === request.locationAtRequest].every(Boolean);
    if (stillCurrent) rememberDsReadBoundary(request.root, actual);
};
