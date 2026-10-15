import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';

import { DesignSystem, Config, Theme } from '../controllers';
import {
    applyDraftChanges,
    confirmDraftToken,
    pendingDraftTokens,
    setActiveDraftContext,
    setPendingMutationListener,
} from '../utils';
import { ThemeEditorRepository, type EditorContextKey } from '../api/themeEditorRepository';
import {
    TokenAutosaveQueue,
    type AutosaveOperation,
    type AutosaveStatus,
} from '../api/tokenAutosaveQueue';
import { isRetryableAutosaveError } from '../api/autosaveHttp';
import type { ThemePalette } from '../modules/palette';
import { setActivePalette } from '../palette/activePalette';
import { paletteRepository, setPaletteSession } from '../palette/paletteSession';

const themeEditorRepository = new ThemeEditorRepository();

type PendingTokenSave = AutosaveOperation & {
    /** Устойчивая идентичность предметной сущности; tokenKey используется только для порядка очереди. */
    entityKey: string;
    tokenName: string;
    previousTokenName?: string;
    change: NonNullable<ReturnType<typeof pendingDraftTokens>[string]>;
    kind: 'create' | 'update' | 'rename' | 'delete';
    definitionPatch?: {
        name?: string;
        displayName?: string;
        description?: string | null;
        enabled?: boolean;
    };
    fingerprint: string;
    idempotencyKey: string;
    editRevision: number;
    tokenBaseRevision: number;
    valueBaseRevisions: Record<string, number>;
    metadataKey: string;
};

type TokenSaveResult = Awaited<ReturnType<ThemeEditorRepository['saveTokenMutation']>>;
const storedMutationKinds = new Set(['create', 'update', 'rename', 'delete']);
const fingerprintText = (serialized: string) => {
    let hash = 2_166_136_261;
    for (let index = 0; index < serialized.length; index += 1) {
        hash ^= serialized.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return `${serialized.length}:${(hash >>> 0).toString(16)}`;
};
const operationFingerprint = (value: unknown) => fingerprintText(JSON.stringify(value));
const normalizedStoredFingerprint = (value: string) =>
    /^\d+:[0-9a-f]+$/.test(value) ? value : fingerprintText(value);

const loadErrorFor = (error: unknown): 'forbidden' | 'not-found' | 'failed' => {
    if (isAxiosError(error)) {
        return ({ 403: 'forbidden', 404: 'not-found' } as const)[error.response?.status ?? 0] ?? 'failed';
    }
    return [error instanceof Error, (error as Error)?.message === 'TENANT_DESIGN_SYSTEM_MISMATCH'].every(Boolean)
        ? 'not-found'
        : 'failed';
};

export const useDesignSystem = (
    designSystemProjectId?: string | EditorContextKey,
    designSystemName?: string,
    designSystemVersion?: string,
    includeExtraTokens = true,
) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);
    const [components, setComponents] = useState<Config[] | null>(null);
    const [composeComponents, setComposeComponents] = useState<Config[]>([]);
    const [incompleteTokenIds, setIncompleteTokenIds] = useState<string[]>([]);
    const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinitionDto[]>([]);
    const [loadError, setLoadError] = useState<'forbidden' | 'not-found' | 'failed' | null>(null);
    const [reloadTrigger, setReloadTrigger] = useState<object>({});
    const [palette, setPaletteState] = useState<ThemePalette | null>(null);
    const [paletteError, setPaletteError] = useState<Error | null>(null);
    // Тема, для которой сейчас загружена палитра: ответы для прежней темы отбрасываются.
    const tenantRef = useRef<string | null>(null);
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
    const autosaveQueue = useRef<TokenAutosaveQueue<PendingTokenSave, TokenSaveResult> | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const loadDesignSystems = async () => {
            setLoadError(null);
            setActivePalette(null);
            setPaletteSession(null);
            setPaletteState(null);
            setPaletteError(null);
            tenantRef.current = typeof designSystemProjectId === 'object' ? designSystemProjectId.tenantId : null;
            if (typeof designSystemProjectId === 'object') {
                const historicalMode = Boolean(designSystemProjectId.versionId);
                setActiveDraftContext(historicalMode ? null : designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                // В режиме api палитра запрашивается параллельно с темой и не задерживает её загрузку.
                const earlyPalette =
                    paletteRepository.source === 'api'
                        ? paletteRepository.load(designSystemProjectId, controller.signal).then(
                              (value) => ({ value }),
                              (error: unknown) => ({ error }),
                          )
                        : null;
                setComposeComponents([]);
                try {
                    const snapshot = await themeEditorRepository.load(designSystemProjectId, controller.signal);
                    if (controller.signal.aborted) return;
                    const ds = DesignSystem.fromSnapshot({
                        name: snapshot.designSystem.name,
                        version: snapshot.publicationVersion,
                        parameters: snapshot.parameters,
                        themeData: snapshot.themeData,
                        componentsData: snapshot.componentsData,
                        composeComponentsData: snapshot.composeComponentsData,
                    });
                    setDesignSystem(ds);
                    setIncompleteTokenIds(snapshot.incompleteTokenIds);
                    setTokenDefinitions(snapshot.tokenDefinitions);
                    const selectedTheme = ds.createThemeInstance({ includeExtraTokens });
                    if (!historicalMode) {
                        applyDraftChanges(selectedTheme, snapshot.designSystem.name, '0.1.0');
                    }
                    setTheme(selectedTheme);
                    setComponents(ds.createAllComponentInstances());
                    if (!historicalMode) {
                        let editRevision = snapshot.editRevision;
                        let mounted = true;
                        const tokenIds = { ...snapshot.tokenIdsByName };
                        const logicalKeyByName = new Map<string, string>();
                        const tokenIdByLogicalKey = new Map<string, string>();
                        const renamedAwayNames = new Map<string, string>();
                        const definitionByLogicalKey = new Map(
                            Object.entries(snapshot.tokenDefinitionsByName ?? {}).map(([name, definition]) => {
                                const logicalKey = `token:${definition.id}`;
                                logicalKeyByName.set(name, logicalKey);
                                tokenIdByLogicalKey.set(logicalKey, definition.id);
                                return [logicalKey, definition] as const;
                            }),
                        );
                        Object.entries(tokenIds).forEach(([name, tokenId]) => {
                            const logicalKey = logicalKeyByName.get(name) ?? `token:${tokenId}`;
                            logicalKeyByName.set(name, logicalKey);
                            tokenIdByLogicalKey.set(logicalKey, tokenId);
                        });
                        const baseRevisions = new Map<string, number>();
                        const valueBaseRevisions = new Map(Object.entries(snapshot.tokenValueRevisionsByKey ?? {}));
                        const latestGenerationByMetadataKey = new Map<string, string>();
                        const metadataKey = (operationKey: string) =>
                            `ds_pending_meta:${designSystemProjectId.projectId}:${designSystemProjectId.designSystemId}:${designSystemProjectId.tenantId}:${operationKey}`;
                        const readMetadata = (key: string): Partial<PendingTokenSave> | null => {
                            const stored = localStorage.getItem(key);
                            if (!stored) return null;
                            try {
                                return JSON.parse(stored) as Partial<PendingTokenSave>;
                            } catch {
                                localStorage.removeItem(key);
                                return null;
                            }
                        };
                        const relevantValueRevisions = (tokenId: string | undefined, tokenName: string) => {
                            if (!tokenId) return {};
                            const mode = tokenName.startsWith('light.')
                                ? 'light'
                                : tokenName.startsWith('dark.')
                                  ? 'dark'
                                  : '';
                            return Object.fromEntries(
                                (['web', 'ios', 'android'] as const)
                                    .map((platform) => {
                                        const key = `${tokenId}:${platform}:${mode}`;
                                        return [key, valueBaseRevisions.get(key)] as const;
                                    })
                                    .filter((entry): entry is readonly [string, number] => entry[1] !== undefined),
                            );
                        };
                        const persistMetadata = (operation: PendingTokenSave) => {
                            const { change: _change, definitionPatch: _definitionPatch, ...metadata } = operation;
                            try {
                                localStorage.setItem(operation.metadataKey, JSON.stringify(metadata));
                            } catch (error) {
                                // The draft body remains under ds_draft:* and the in-memory queue can still save it.
                                console.warn('[useDesignSystem] Не удалось сохранить служебные данные автосохранения', error);
                            }
                        };
                        const queue = new TokenAutosaveQueue<PendingTokenSave, TokenSaveResult>({
                            send: (operation, keepalive) => {
                                const baseName = operation.tokenName.replace(/^(light|dark)\./, '');
                                const previousBaseName = operation.previousTokenName?.replace(/^(light|dark)\./, '');
                                const currentValueRevisions = {
                                    ...operation.valueBaseRevisions,
                                    ...relevantValueRevisions(
                                        tokenIdByLogicalKey.get(operation.entityKey),
                                        operation.tokenName,
                                    ),
                                };
                                return themeEditorRepository.saveTokenMutation(
                                    designSystemProjectId,
                                    tokenIdByLogicalKey.get(operation.entityKey),
                                    {
                                        tokenName: operation.tokenName,
                                        previousTokenName: operation.previousTokenName,
                                        change: operation.change,
                                        kind: operation.kind,
                                        definitionPatch: operation.definitionPatch,
                                    },
                                    Math.max(editRevision, operation.editRevision),
                                    Math.max(
                                        operation.tokenBaseRevision,
                                        baseRevisions.get(previousBaseName ?? baseName) ?? 0,
                                    ),
                                    currentValueRevisions,
                                    operation.idempotencyKey,
                                    keepalive,
                                );
                            },
                            confirmed: (operation, result) => {
                                const baseName = operation.tokenName.replace(/^(light|dark)\./, '');
                                const previousBaseName = operation.previousTokenName?.replace(/^(light|dark)\./, '');
                                if ([previousBaseName, previousBaseName !== baseName].every(Boolean))
                                    delete tokenIds[previousBaseName!];
                                tokenIds[baseName] = result.tokenId;
                                tokenIdByLogicalKey.set(operation.entityKey, result.tokenId);
                                logicalKeyByName.set(baseName, operation.entityKey);
                                if ([previousBaseName, previousBaseName !== baseName].every(Boolean)) {
                                    logicalKeyByName.delete(previousBaseName!);
                                    renamedAwayNames.delete(previousBaseName!);
                                }
                                if (operation.kind === 'delete') {
                                    delete tokenIds[baseName];
                                    tokenIdByLogicalKey.delete(operation.entityKey);
                                    definitionByLogicalKey.delete(operation.entityKey);
                                } else {
                                    const previousDefinition = definitionByLogicalKey.get(operation.entityKey);
                                    definitionByLogicalKey.set(operation.entityKey, {
                                        ...(previousDefinition ?? {
                                            id: result.tokenId,
                                            designSystemId: designSystemProjectId.designSystemId,
                                            name: baseName,
                                            type: operation.change.type,
                                            displayName: operation.change.meta?.displayName ?? baseName,
                                            description: operation.change.description ?? null,
                                            enabled: operation.change.enabled,
                                        }),
                                        ...operation.definitionPatch,
                                        id: result.tokenId,
                                    });
                                }
                                editRevision = Math.max(editRevision, result.editRevision);
                                baseRevisions.set(
                                    baseName,
                                    Math.max(baseRevisions.get(baseName) ?? 0, result.baseRevision),
                                );
                                Object.entries(result.valueBaseRevisions).forEach(([key, revision]) =>
                                    valueBaseRevisions.set(key, Math.max(valueBaseRevisions.get(key) ?? 0, revision)),
                                );
                                if (latestGenerationByMetadataKey.get(operation.metadataKey) !== operation.generation)
                                    return;
                                const confirmedNames =
                                    operation.kind === 'delete'
                                        ? [baseName, `light.${baseName}`, `dark.${baseName}`]
                                        : [operation.tokenName];
                                confirmedNames.forEach((confirmedName) =>
                                    confirmDraftToken(
                                        snapshot.designSystem.name,
                                        '0.1.0',
                                        confirmedName,
                                        designSystemProjectId,
                                    ),
                                );
                                localStorage.removeItem(operation.metadataKey);
                                latestGenerationByMetadataKey.delete(operation.metadataKey);
                            },
                            retryable: isRetryableAutosaveError,
                            statusChanged: (status) => {
                                if (mounted) setAutosaveStatus(status);
                            },
                        });
                        autosaveQueue.current = queue;
                        const schedule = (
                            tokenName: string,
                            change: NonNullable<ReturnType<typeof pendingDraftTokens>[string]>,
                            kind: 'create' | 'update' | 'rename' | 'delete',
                            previousTokenName?: string,
                        ) => {
                            const baseName = tokenName.replace(/^(light|dark)\./, '');
                            const previousBaseName = previousTokenName?.replace(/^(light|dark)\./, '');
                            const knownTokenId = tokenIds[previousBaseName ?? baseName];
                            const existingLogicalKey =
                                (previousBaseName ? logicalKeyByName.get(previousBaseName) : undefined) ??
                                logicalKeyByName.get(baseName) ??
                                (knownTokenId ? `token:${knownTokenId}` : `new:${crypto.randomUUID()}`);
                            const renameQueueKey = kind === 'create' ? renamedAwayNames.get(baseName) : undefined;
                            const entityKey = renameQueueKey ? `new:${crypto.randomUUID()}` : existingLogicalKey;
                            const queueKey = renameQueueKey ?? entityKey;
                            if (!renameQueueKey) logicalKeyByName.set(baseName, entityKey);
                            if (previousBaseName) {
                                logicalKeyByName.set(previousBaseName, entityKey);
                                if (kind === 'rename') renamedAwayNames.set(previousBaseName, queueKey);
                            }
                            if ([knownTokenId, !renameQueueKey].every(Boolean))
                                tokenIdByLogicalKey.set(entityKey, knownTokenId!);
                            const confirmedDefinition = definitionByLogicalKey.get(entityKey);
                            const desiredDefinition = {
                                name: baseName,
                                displayName: change.meta?.displayName,
                                description: change.description ?? null,
                                enabled: change.enabled,
                            };
                            const definitionKeys = change.meta
                                ? (['name', 'displayName', 'description', 'enabled'] as const)
                                : (['description', 'enabled'] as const);
                            const definitionPatch = confirmedDefinition
                                ? Object.fromEntries(
                                      definitionKeys
                                          .filter((key) => desiredDefinition[key] !== confirmedDefinition[key])
                                          .map((key) => [key, desiredDefinition[key]]),
                                  )
                                : undefined;
                            const operationKey = kind === 'delete' ? baseName : tokenName;
                            const requestMetadataKey = metadataKey(operationKey);
                            const fingerprint = operationFingerprint({ tokenName, previousTokenName, change, kind });
                            const stored = readMetadata(requestMetadataKey);
                            const storedFingerprint = stored?.fingerprint;
                            const sameOperation =
                                storedFingerprint === fingerprint ||
                                (typeof storedFingerprint === 'string' &&
                                    normalizedStoredFingerprint(storedFingerprint) === fingerprint);
                            const operation = Object.assign(
                                {
                                    tokenKey: queueKey,
                                    entityKey,
                                    operationKey,
                                    generation: crypto.randomUUID(),
                                    retryCount: 0,
                                    idempotencyKey: crypto.randomUUID(),
                                    editRevision,
                                    tokenBaseRevision: baseRevisions.get(previousBaseName ?? baseName) ?? 0,
                                    valueBaseRevisions: relevantValueRevisions(knownTokenId, tokenName),
                                },
                                sameOperation ? stored : {},
                                // Эти поля описывают текущее изменение и не должны подменяться содержимым localStorage.
                                {
                                    tokenName,
                                    previousTokenName,
                                    change,
                                    kind,
                                    definitionPatch,
                                    fingerprint,
                                    metadataKey: requestMetadataKey,
                                    valueBaseRevisions: relevantValueRevisions(knownTokenId, tokenName),
                                },
                            ) as PendingTokenSave;
                            latestGenerationByMetadataKey.set(requestMetadataKey, operation.generation);
                            persistMetadata(operation);
                            queue.enqueue(operation);
                        };
                        setPendingMutationListener(({ tokenName, previousTokenName, change, kind }) => {
                            if ([kind === 'discard', !change].some(Boolean)) {
                                const baseName = tokenName.replace(/^(light|dark)\./, '');
                                const logicalKey = logicalKeyByName.get(baseName) ?? baseName;
                                queue.discard(logicalKey, tokenName);
                                queue.discard(logicalKey, baseName);
                                localStorage.removeItem(metadataKey(tokenName));
                                localStorage.removeItem(metadataKey(baseName));
                                latestGenerationByMetadataKey.delete(metadataKey(tokenName));
                                latestGenerationByMetadataKey.delete(metadataKey(baseName));
                                return;
                            }
                            schedule(tokenName, change!, kind as PendingTokenSave['kind'], previousTokenName);
                        });
                        const restoredOperations = Object.entries(
                            pendingDraftTokens(snapshot.designSystem.name, '0.1.0'),
                        ).map(([tokenName, change]) => {
                            const stored = readMetadata(metadataKey(tokenName));
                            const storedKind = stored?.kind;
                            if (
                                [
                                    typeof stored?.tokenName === 'string',
                                    storedMutationKinds.has(storedKind ?? ''),
                                ].every(Boolean)
                            ) {
                                return {
                                    tokenName: stored!.tokenName!,
                                    change,
                                    kind: storedKind as PendingTokenSave['kind'],
                                    previousTokenName: stored!.previousTokenName,
                                };
                            }
                            return {
                                tokenName,
                                change,
                                kind: change.deleted
                                    ? ('delete' as const)
                                    : tokenIds[tokenName.replace(/^(light|dark)\./, '')]
                                      ? ('update' as const)
                                      : ('create' as const),
                            };
                        });
                        restoredOperations
                            .sort((left, right) => Number(right.kind === 'rename') - Number(left.kind === 'rename'))
                            .forEach((operation) =>
                                schedule(
                                    operation.tokenName,
                                    operation.change,
                                    operation.kind,
                                    operation.previousTokenName,
                                ),
                            );
                        const flushOnPageHide = () => queue.flushAll(true);
                        window.addEventListener('pagehide', flushOnPageHide);
                        controller.signal.addEventListener('abort', () => {
                            mounted = false;
                            setPendingMutationListener(null);
                            window.removeEventListener('pagehide', flushOnPageHide);
                            queue.flushAll(true);
                            if (autosaveQueue.current === queue) autosaveQueue.current = null;
                        });
                    }
                    setPaletteSession({
                        context: designSystemProjectId,
                        designSystem: ds,
                        theme: selectedTheme,
                        tokens: snapshot.tokenDefinitions
                            .filter((token) => token.type === 'color')
                            .map((token) => ({ id: token.id, name: token.name, displayName: token.displayName })),
                        readOnly: snapshot.parameters.readOnly === true,
                    });
                    try {
                        const early = earlyPalette ? await earlyPalette : null;
                        if (early && 'error' in early) throw early.error;
                        const loadedPalette = early
                            ? early.value
                            : await paletteRepository.load(designSystemProjectId, controller.signal);
                        if (controller.signal.aborted) return;
                        setActivePalette(loadedPalette);
                        setPaletteState(loadedPalette);
                    } catch (error) {
                        if (controller.signal.aborted) return;
                        setPaletteError(error instanceof Error ? error : new Error(String(error)));
                        console.error('[useDesignSystem] Не удалось загрузить палитру темы', error);
                    }
                    setComposeComponents(ds.createAllComposeComponentInstances());
                } catch (error) {
                    if (!controller.signal.aborted) {
                        setLoadError(loadErrorFor(error));
                        console.error('[useDesignSystem] Не удалось загрузить тему', error);
                    }
                }
                return;
            }
            if ([designSystemName, designSystemVersion].some((value) => !value)) {
                return;
            }
            setActiveDraftContext(null);

            try {
                const ds = await DesignSystem.get({
                    name: designSystemName!,
                    version: designSystemVersion!,
                    projectId: designSystemProjectId,
                });
                setDesignSystem(ds);

                const themeInstance = ds.createThemeInstance({ includeExtraTokens });
                applyDraftChanges(themeInstance, designSystemName!, designSystemVersion!);
                setTheme(themeInstance);

                setComponents(ds.createAllComponentInstances());
            } catch (error) {
                setLoadError(loadErrorFor(error));
                console.error('[useDesignSystem] Не удалось загрузить дизайн-систему', error);
            }
        };

        loadDesignSystems();
        return () => {
            controller.abort();
            setActivePalette(null);
        };
    }, [designSystemProjectId, designSystemName, designSystemVersion, includeExtraTokens, reloadTrigger]);

    const reload = useCallback(() => setReloadTrigger({}), []);
    const retryAutosave = useCallback(() => autosaveQueue.current?.retryFailed(), []);

    /** Обновляет палитру открытой темы после операции; превью перечитывают активную палитру. */
    const setPalette = useCallback((next: ThemePalette) => {
        if (next.tenantId !== tenantRef.current) return;
        setActivePalette(next);
        setPaletteState(next);
        setPaletteError(null);
    }, []);
    return {
        designSystem,
        theme,
        components,
        incompleteTokenIds,
        loadError,
        reload,
        autosaveStatus,
        retryAutosave,
    };
};
