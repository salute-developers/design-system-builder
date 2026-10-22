import type { EditorContextKey, ThemeEditorTokenSnapshot } from './editorContracts';
import { tokenValueKey } from './editorHttp';
import { authService } from './authService';

interface Revisions {
    byEntity: Map<string, number>;
    valueEntities: Map<string, string>;
    byAddress: Map<string, number>;
    /** Признак своего значения платформы по ключу `tokenValueKey` из прочитанного или подтверждённого состояния. */
    overridden: Map<string, boolean>;
}
const contexts = new Map<string, Revisions>();
const revisionsOf = (context: EditorContextKey) => {
    const key = JSON.stringify([context.projectId, context.designSystemId, context.tenantId, context.versionId]);
    let value = contexts.get(key);
    if (!value) {
        value = { byEntity: new Map(), valueEntities: new Map(), byAddress: new Map(), overridden: new Map() };
        // Сессия браузера не хранит неограниченную историю посещённых тем.
        if (contexts.size >= 32) contexts.delete(contexts.keys().next().value!);
        contexts.set(key, value);
    }
    return value;
};
authService.onSessionReset(() => contexts.clear());

/** Чтение устанавливает предметные редакции того же состояния, которое получил редактор. */
export const observeTokenValueRevisions = (
    context: EditorContextKey,
    snapshot: Pick<
        ThemeEditorTokenSnapshot,
        'tokenValueRevisionsByKey' | 'tokenValueEntityIdsByKey' | 'tokenValueOverriddenByKey'
    >,
) => {
    const revisions = revisionsOf(context);
    for (const [key, id] of Object.entries(snapshot.tokenValueEntityIdsByKey ?? {})) {
        revisions.valueEntities.set(key, id);
        revisions.byEntity.set(`token-value:${id}`, snapshot.tokenValueRevisionsByKey[key] ?? 0);
    }
    revisions.overridden = new Map(Object.entries(snapshot.tokenValueOverriddenByKey ?? {}));
};

/** Признак своего значения платформы в последнем прочитанном или подтверждённом состоянии. */
export const tokenValueOverridden = (context: EditorContextKey, tokenId: string, platform: string, mode: string) =>
    revisionsOf(context).overridden.get(tokenValueKey(tokenId, platform, mode)) === true;

/** Запоминает подтверждённый сервером признак своего значения платформы. */
export const acceptTokenValueOverridden = (
    context: EditorContextKey,
    tokenId: string,
    platform: string,
    mode: string,
    overridden: boolean,
) => revisionsOf(context).overridden.set(tokenValueKey(tokenId, platform, mode), overridden);

/** Сохраняет технические редакции подтверждённой операции без использования общего счётчика темы. */
export const observeSubjectRevisions = (
    context: EditorContextKey,
    metadata: Array<{ entityType: string; entityId: string; revision: number }>,
) => {
    const revisions = revisionsOf(context);
    metadata.forEach((item) => {
        if (Number.isSafeInteger(item.revision) && item.revision >= 0)
            revisions.byEntity.set(`${item.entityType}:${item.entityId}`, item.revision);
    });
};

export const tokenValueBaseRevision = (context: EditorContextKey, tokenId: string, platform: string, mode: string) => {
    const revisions = revisionsOf(context);
    const id = revisions.valueEntities.get(tokenValueKey(tokenId, platform, mode));
    return id ? (revisions.byEntity.get(`token-value:${id}`) ?? 0) : 0;
};

/** Применяет редакции адресов одновременно с прочитанным предметным состоянием. */
export const observeSubjectAddresses = (
    context: EditorContextKey,
    namespace: string,
    values: Record<string, number>,
) => {
    const revisions = revisionsOf(context).byAddress;
    [...revisions.keys()].forEach((key) => {
        if (key.startsWith(`${namespace}:`)) revisions.delete(key);
    });
    Object.entries(values).forEach(([address, revision]) => revisions.set(`${namespace}:${address}`, revision));
};
export const subjectBaseRevision = (context: EditorContextKey, address: string) =>
    revisionsOf(context).byAddress.get(address) ?? 0;
export const acceptSubjectAddress = (context: EditorContextKey, address: string, revision: number) =>
    revisionsOf(context).byAddress.set(address, revision);
