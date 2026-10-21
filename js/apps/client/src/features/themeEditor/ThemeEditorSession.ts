import { loadThemeEditor, loadDesignSystemCursor } from '../../api/themeEditorRepository';
import { tokenRepository } from '../../api/tokenRepository';
import { componentRepository } from '../../api/componentRepository';
import { invalidateEditorReads } from '../../api/editorReads';
import { subscribeIncompleteMutationMetadata } from '../../api/incompleteMutationMetadata';
import type {
    EditorContextKey,
    ThemeEditorSnapshot,
    TokenDefinitionDto,
    DraftChangeDto,
} from '../../api/editorContracts';
import { TokenAutosaveQueue, type AutosaveOperation, type AutosaveStatus } from '../../api/tokenAutosaveQueue';
import { isRetryableAutosaveError } from '../../api/autosaveHttp';
import {
    subscribeToDraftInvalidations,
    type DraftInvalidationEvent,
    type DraftInvalidationScope,
} from '../../api/draftInvalidationStream';
import {
    waitForDraftAutosaveIdle,
    getDraftAutosaveRevision,
    isDraftAutosaveIdle,
    reloadWhenDraftAutosaveIsIdle,
    setDraftAutosaveActivity,
} from '../../api/draftAutosaveActivity';
import { confirmDraftToken, pendingDraftTokens, setPendingMutationListener } from '../../utils/designSystemDraft';
import { restorePendingSizeTokenCommands } from '../../modules/sizeTokens/sessions';

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

type TokenSaveResult = Awaited<ReturnType<typeof tokenRepository.saveTokenMutation>>;
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
const normalizedStoredFingerprint = (value: string) => (/^\d+:[0-9a-f]+$/.test(value) ? value : fingerprintText(value));

interface SessionOptions {
    context: EditorContextKey;
    snapshot: ThemeEditorSnapshot;
    signal: AbortSignal;
    onSaved: () => void;
    onStatus: (status: AutosaveStatus) => void;
    onSnapshot: (snapshot: ThemeEditorSnapshot, tokensChanged: boolean, componentsChanged: boolean) => void;
    onDisposed: () => void;
}
type PendingMutationEvent = Parameters<NonNullable<Parameters<typeof setPendingMutationListener>[0]>>[0];

/** Владеет очередью, редакциями и SSE одного открытого черновика; не зависит от React. */
export class ThemeEditorSession {
    private readonly options: SessionOptions;
    private readonly context: EditorContextKey;
    private readonly signal: AbortSignal;
    private snapshot: ThemeEditorSnapshot;
    private editRevision: number;
    private mounted = true;
    private readonly tokenIds: Record<string, string>;
    private readonly logicalKeyByName = new Map<string, string>();
    private readonly tokenIdByLogicalKey = new Map<string, string>();
    private readonly renamedAwayNames = new Map<string, string>();
    private readonly definitionByLogicalKey = new Map<string, TokenDefinitionDto>();
    private readonly baseRevisions = new Map<string, number>();
    private readonly valueBaseRevisions: Map<string, number>;
    private readonly latestGenerationByMetadataKey = new Map<string, string>();
    private readonly queue: TokenAutosaveQueue<PendingTokenSave, TokenSaveResult>;
    private cancelDeferredReload: () => void = () => undefined;
    private cancelIncompleteMetadataRefresh: () => void = () => undefined;
    private retryRemoteReload: number | undefined;
    private remoteReloadRunning = false;
    private reloadChain: Promise<void> = Promise.resolve();
    private latestRemoteEvent: DraftInvalidationEvent | undefined;
    private readonly pendingRemoteScopes = new Set<DraftInvalidationScope>();

    constructor(options: SessionOptions) {
        this.options = options;
        this.context = options.context;
        this.signal = options.signal;
        this.snapshot = options.snapshot;
        this.editRevision = options.snapshot.editRevision;
        this.tokenIds = {};
        this.valueBaseRevisions = new Map();
        this.replaceTokenRuntimeState(options.snapshot);
        this.queue = new TokenAutosaveQueue({
            send: this.send.bind(this),
            confirmed: this.confirmed.bind(this),
            retryable: isRetryableAutosaveError,
            statusChanged: this.statusChanged.bind(this),
        });
        this.flushOnPageHide = this.flushOnPageHide.bind(this);
        this.dispose = this.dispose.bind(this);
        this.scheduleRemoteReload = this.scheduleRemoteReload.bind(this);
    }

    start() {
        this.cancelIncompleteMetadataRefresh = subscribeIncompleteMutationMetadata(this.context, (scope) => {
            if (this.signal.aborted) return;
            invalidateEditorReads();
            this.latestRemoteEvent = undefined;
            this.pendingRemoteScopes.add(scope);
            this.scheduleRemoteReload();
        });
        setDraftAutosaveActivity(this.context, 'tokens', 'saved');
        setPendingMutationListener(this.handleMutation.bind(this));
        this.restorePending();
        // Команды раздела «Отступы, радиусы и тени» повторяются своими операциями, а не общей записью значений.
        restorePendingSizeTokenCommands(this.context);
        if (this.snapshot.designSystem.draftId && this.snapshot.designSystem.draftRevision != null) {
            void subscribeToDraftInvalidations({
                context: this.context,
                draftId: this.snapshot.designSystem.draftId,
                draftRevision: this.snapshot.designSystem.draftRevision,
                signal: this.signal,
                received: (event) => {
                    this.latestRemoteEvent = event;
                    event.scopes.forEach((scope) => this.pendingRemoteScopes.add(scope));
                    this.scheduleRemoteReload();
                },
            });
        }
        window.addEventListener('pagehide', this.flushOnPageHide);
        this.signal.addEventListener('abort', this.dispose, { once: true });
    }

    retryFailed() {
        this.queue.retryFailed();
    }

    private flushOnPageHide() {
        this.queue.flushAll(true);
    }

    private dispose() {
        if (!this.mounted) return;
        this.mounted = false;
        this.cancelDeferredReload();
        this.cancelIncompleteMetadataRefresh();
        if (this.retryRemoteReload !== undefined) window.clearTimeout(this.retryRemoteReload);
        setPendingMutationListener(null);
        window.removeEventListener('pagehide', this.flushOnPageHide);
        this.queue.dispose();
        setDraftAutosaveActivity(this.context, 'tokens', null);
        this.options.onDisposed();
    }

    private applyRemoteSnapshot(next: ThemeEditorSnapshot, tokensChanged: boolean, componentsChanged: boolean) {
        this.snapshot = next;
        if (tokensChanged) this.replaceTokenRuntimeState(next);
        this.options.onSnapshot(next, tokensChanged, componentsChanged);
    }
    private metadataKey(operationKey: string) {
        return `ds_pending_meta:${this.context.projectId}:${this.context.designSystemId}:${this.context.tenantId}:${operationKey}`;
    }

    private readMetadata(key: string) {
        let stored: string | null;
        try {
            stored = localStorage.getItem(key);
        } catch {
            return null;
        }
        if (!stored) return null;
        try {
            return JSON.parse(stored) as Partial<PendingTokenSave>;
        } catch {
            try {
                localStorage.removeItem(key);
            } catch {
                // Corrupted recovery metadata must not block the in-memory queue.
            }
            return null;
        }
    }

    private relevantValueRevisions(tokenId: string | undefined, tokenName: string) {
        if (!tokenId) return {};
        const mode = tokenName.startsWith('light.') ? 'light' : tokenName.startsWith('dark.') ? 'dark' : '';
        return Object.fromEntries(
            (['web', 'ios', 'android'] as const)
                .map((platform) => {
                    const key = `${tokenId}:${platform}:${mode}`;
                    return [key, this.valueBaseRevisions.get(key)] as const;
                })
                .filter((entry): entry is readonly [string, number] => entry[1] !== undefined),
        );
    }

    private persistMetadata(operation: PendingTokenSave) {
        const { change: _change, definitionPatch: _definitionPatch, ...metadata } = operation;
        try {
            localStorage.setItem(operation.metadataKey, JSON.stringify(metadata));
        } catch (error) {
            // The draft body remains under ds_draft:* and the in-memory queue can still save it.
            console.warn('[useDesignSystem] Не удалось сохранить служебные данные автосохранения', error);
        }
    }

    private schedule(
        tokenName: string,
        change: NonNullable<ReturnType<typeof pendingDraftTokens>[string]>,
        kind: 'create' | 'update' | 'rename' | 'delete',
        previousTokenName?: string,
    ) {
        const baseName = tokenName.replace(/^(light|dark)\./, '');
        const previousBaseName = previousTokenName?.replace(/^(light|dark)\./, '');
        const knownTokenId = this.tokenIds[previousBaseName ?? baseName];
        const existingLogicalKey =
            (previousBaseName ? this.logicalKeyByName.get(previousBaseName) : undefined) ??
            this.logicalKeyByName.get(baseName) ??
            (knownTokenId ? `token:${knownTokenId}` : `new:${crypto.randomUUID()}`);
        const renameQueueKey = kind === 'create' ? this.renamedAwayNames.get(baseName) : undefined;
        const entityKey = renameQueueKey ? `new:${crypto.randomUUID()}` : existingLogicalKey;
        const queueKey = renameQueueKey ?? entityKey;
        if (!renameQueueKey) this.logicalKeyByName.set(baseName, entityKey);
        if (previousBaseName) {
            this.logicalKeyByName.set(previousBaseName, entityKey);
            if (kind === 'rename') this.renamedAwayNames.set(previousBaseName, queueKey);
        }
        if ([knownTokenId, !renameQueueKey].every(Boolean)) this.tokenIdByLogicalKey.set(entityKey, knownTokenId!);
        const confirmedDefinition = this.definitionByLogicalKey.get(entityKey);
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
        const requestMetadataKey = this.metadataKey(operationKey);
        const fingerprint = operationFingerprint({ tokenName, previousTokenName, change, kind });
        const stored = this.readMetadata(requestMetadataKey);
        const storedFingerprint = stored?.fingerprint;
        const sameOperation =
            storedFingerprint === fingerprint ||
            (typeof storedFingerprint === 'string' && normalizedStoredFingerprint(storedFingerprint) === fingerprint);
        const operation = Object.assign(
            {
                tokenKey: queueKey,
                entityKey,
                operationKey,
                generation: crypto.randomUUID(),
                retryCount: 0,
                idempotencyKey: crypto.randomUUID(),
                editRevision: this.editRevision,
                tokenBaseRevision: this.baseRevisions.get(previousBaseName ?? baseName) ?? 0,
                valueBaseRevisions: this.relevantValueRevisions(knownTokenId, tokenName),
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
                valueBaseRevisions: this.relevantValueRevisions(knownTokenId, tokenName),
            },
        ) as PendingTokenSave;
        this.latestGenerationByMetadataKey.set(requestMetadataKey, operation.generation);
        this.persistMetadata(operation);
        this.queue.enqueue(operation);
    }

    private replaceTokenRuntimeState(next: ThemeEditorSnapshot) {
        this.editRevision = Math.max(this.editRevision, next.editRevision);
        Object.keys(this.tokenIds).forEach((name) => delete this.tokenIds[name]);
        Object.assign(this.tokenIds, next.tokenIdsByName);
        this.logicalKeyByName.clear();
        this.tokenIdByLogicalKey.clear();
        this.definitionByLogicalKey.clear();
        this.renamedAwayNames.clear();
        Object.entries(next.tokenDefinitionsByName ?? {}).forEach(([name, definition]) => {
            const logicalKey = `token:${definition.id}`;
            this.logicalKeyByName.set(name, logicalKey);
            this.tokenIdByLogicalKey.set(logicalKey, definition.id);
            this.definitionByLogicalKey.set(logicalKey, definition);
        });
        Object.entries(this.tokenIds).forEach(([name, tokenId]) => {
            const logicalKey = this.logicalKeyByName.get(name) ?? `token:${tokenId}`;
            this.logicalKeyByName.set(name, logicalKey);
            this.tokenIdByLogicalKey.set(logicalKey, tokenId);
        });
        this.baseRevisions.clear();
        this.valueBaseRevisions.clear();
        Object.entries(next.tokenValueRevisionsByKey ?? {}).forEach(([key, revision]) =>
            this.valueBaseRevisions.set(key, revision),
        );
    }

    private scheduleRemoteReload() {
        if (this.retryRemoteReload !== undefined) {
            window.clearTimeout(this.retryRemoteReload);
            this.retryRemoteReload = undefined;
        }
        this.cancelDeferredReload();
        this.cancelDeferredReload = reloadWhenDraftAutosaveIsIdle(this.context, () => void this.runRemoteReload());
    }

    private async runRemoteReload() {
        if (this.remoteReloadRunning || this.pendingRemoteScopes.size === 0) return;
        this.remoteReloadRunning = true;
        const event = this.latestRemoteEvent;
        const scopes = new Set(this.pendingRemoteScopes);
        this.pendingRemoteScopes.clear();
        try {
            await this.refreshSnapshot(scopes, event);
        } catch (error) {
            if (!this.signal.aborted) {
                scopes.forEach((scope) => this.pendingRemoteScopes.add(scope));
                console.warn('[useDesignSystem] Не удалось обновить изменённые данные', error);
                this.retryRemoteReload = window.setTimeout(this.scheduleRemoteReload, 2_000);
            }
        } finally {
            this.remoteReloadRunning = false;
            if (this.pendingRemoteScopes.size > 0 && this.retryRemoteReload === undefined) {
                this.scheduleRemoteReload();
            }
        }
    }

    /** Перечитывает подтверждённые предметные данные после локальной отмены, даже без SSE-эха. */
    refreshChanges(changes: DraftChangeDto[]) {
        const scopes = new Set<DraftInvalidationScope>();
        for (const change of changes) {
            if (
                change.entityType === 'token' ||
                change.entityType === 'token-value' ||
                change.entityType === 'token-group' ||
                change.entityType.startsWith('palette-')
            )
                scopes.add('theme-tokens');
            else if (change.entityType === 'tenant') scopes.add('theme-metadata');
            else scopes.add('all');
        }
        return this.refreshSnapshot(scopes);
    }

    private refreshSnapshot(scopes: Set<DraftInvalidationScope>, event?: DraftInvalidationEvent) {
        const refresh = this.reloadChain
            .catch(() => undefined)
            .then(async () => {
                while (!this.signal.aborted) {
                    await waitForDraftAutosaveIdle(this.context, 10_000);
                    if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
                    const activityRevision = getDraftAutosaveRevision(this.context);
                    const fullReload =
                        scopes.has('all') ||
                        scopes.has('design-system') ||
                        Boolean(event && event.draftId !== this.snapshot.designSystem.draftId);
                    const tokensChanged = fullReload || scopes.has('theme-tokens') || scopes.has('theme-metadata');
                    const componentsChanged = fullReload || scopes.has('component-configurations');
                    let next = this.snapshot;
                    if (fullReload) {
                        next = await loadThemeEditor(this.context, this.signal);
                    } else {
                        const [tokenData, componentData, composeData, designSystem] = await Promise.all([
                            tokensChanged
                                ? tokenRepository.loadTokenData(
                                      this.context,
                                      this.signal,
                                      this.snapshot.publicationVersion,
                                  )
                                : Promise.resolve(null),
                            componentsChanged
                                ? componentRepository.loadComponentData(this.context, this.signal)
                                : Promise.resolve(null),
                            componentsChanged
                                ? componentRepository.loadComposeComponentData(this.context, this.signal)
                                : Promise.resolve(null),
                            loadDesignSystemCursor(this.context, this.signal),
                        ]);
                        if (tokenData?.paletteError) throw tokenData.paletteError;
                        next = {
                            ...this.snapshot,
                            ...(tokenData ?? {}),
                            componentsData: componentData ?? this.snapshot.componentsData,
                            composeComponentsData: composeData ?? this.snapshot.composeComponentsData,
                            designSystem,
                            parameters: {
                                ...this.snapshot.parameters,
                                ...(tokenData ? { editRevision: tokenData.editRevision } : {}),
                                draftId: designSystem.draftId ?? undefined,
                                draftRevision: designSystem.draftRevision ?? undefined,
                            },
                        };
                    }
                    if (
                        !isDraftAutosaveIdle(this.context) ||
                        activityRevision !== getDraftAutosaveRevision(this.context)
                    ) {
                        continue;
                    }
                    if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
                    this.applyRemoteSnapshot(next, tokensChanged, componentsChanged);

                    return;
                }
                throw new Error('EDITOR_CLOSED');
            });
        this.reloadChain = refresh;
        return refresh;
    }

    private send(operation: PendingTokenSave, keepalive: boolean) {
        if (!this.mounted || this.signal.aborted) throw new Error('EDITOR_CLOSED');
        const baseName = operation.tokenName.replace(/^(light|dark)\./, '');
        const previousBaseName = operation.previousTokenName?.replace(/^(light|dark)\./, '');
        const tokenId = this.tokenIdByLogicalKey.get(operation.entityKey);
        if (operation.kind === 'delete' && !tokenId) {
            // После потери ответа удалённая сущность уже отсутствует в подтверждённом снимке.
            return Promise.resolve({
                tokenId: operation.entityKey.replace(/^token:/, ''),
                editRevision: this.editRevision,
                baseRevision: operation.tokenBaseRevision,
                valueBaseRevisions: operation.valueBaseRevisions,
            });
        }
        const currentValueRevisions = {
            ...operation.valueBaseRevisions,
            ...this.relevantValueRevisions(this.tokenIdByLogicalKey.get(operation.entityKey), operation.tokenName),
        };
        return tokenRepository.saveTokenMutation(
            this.context,
            this.tokenIdByLogicalKey.get(operation.entityKey),
            {
                tokenName: operation.tokenName,
                previousTokenName: operation.previousTokenName,
                change: operation.change,
                kind: operation.kind,
                definitionPatch: operation.definitionPatch,
            },
            Math.max(this.editRevision, operation.editRevision),
            Math.max(operation.tokenBaseRevision, this.baseRevisions.get(previousBaseName ?? baseName) ?? 0),
            currentValueRevisions,
            operation.idempotencyKey,
            keepalive,
            this.signal,
        );
    }

    private confirmed(operation: PendingTokenSave, result: TokenSaveResult) {
        if (!this.mounted || this.signal.aborted) return;
        if (this.mounted) this.options.onSaved();
        const baseName = operation.tokenName.replace(/^(light|dark)\./, '');
        const previousBaseName = operation.previousTokenName?.replace(/^(light|dark)\./, '');
        if ([previousBaseName, previousBaseName !== baseName].every(Boolean)) delete this.tokenIds[previousBaseName!];
        const affectsCurrentName = operation.kind !== 'delete' || this.tokenIds[baseName] === result.tokenId;
        if ([previousBaseName, previousBaseName !== baseName].every(Boolean)) {
            this.logicalKeyByName.delete(previousBaseName!);
            this.renamedAwayNames.delete(previousBaseName!);
        }
        if (operation.kind === 'delete') {
            if (this.tokenIds[baseName] === result.tokenId) delete this.tokenIds[baseName];
            this.tokenIdByLogicalKey.delete(operation.entityKey);
            this.definitionByLogicalKey.delete(operation.entityKey);
        } else {
            this.tokenIds[baseName] = result.tokenId;
            this.tokenIdByLogicalKey.set(operation.entityKey, result.tokenId);
            this.logicalKeyByName.set(baseName, operation.entityKey);
            const previousDefinition = this.definitionByLogicalKey.get(operation.entityKey);
            this.definitionByLogicalKey.set(operation.entityKey, {
                ...(previousDefinition ?? {
                    id: result.tokenId,
                    designSystemId: this.context.designSystemId,
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
        this.editRevision = Math.max(this.editRevision, result.editRevision);
        if (affectsCurrentName)
            this.baseRevisions.set(baseName, Math.max(this.baseRevisions.get(baseName) ?? 0, result.baseRevision));
        Object.entries(result.valueBaseRevisions).forEach(([key, revision]) =>
            this.valueBaseRevisions.set(key, Math.max(this.valueBaseRevisions.get(key) ?? 0, revision)),
        );
        if (this.latestGenerationByMetadataKey.get(operation.metadataKey) !== operation.generation) return;
        const stored = this.readMetadata(operation.metadataKey);
        if (stored && stored.generation !== operation.generation) return;
        const confirmedNames =
            operation.kind === 'delete' ? [baseName, `light.${baseName}`, `dark.${baseName}`] : [operation.tokenName];
        confirmedNames.forEach((confirmedName) =>
            confirmDraftToken(this.snapshot.designSystem.name, '0.1.0', confirmedName, this.context),
        );
        try {
            localStorage.removeItem(operation.metadataKey);
        } catch {
            // The confirmed server state is authoritative.
        }
        this.latestGenerationByMetadataKey.delete(operation.metadataKey);
    }

    private statusChanged(status: AutosaveStatus) {
        if (this.mounted) {
            setDraftAutosaveActivity(this.context, 'tokens', status);
            this.options.onStatus(status);
        }
    }

    private handleMutation({ tokenName, previousTokenName, change, kind }: PendingMutationEvent) {
        if ([kind === 'discard', !change].some(Boolean)) {
            const baseName = tokenName.replace(/^(light|dark)\./, '');
            const logicalKey = this.logicalKeyByName.get(baseName) ?? baseName;
            this.queue.discard(logicalKey, tokenName);
            this.queue.discard(logicalKey, baseName);
            try {
                localStorage.removeItem(this.metadataKey(tokenName));
                localStorage.removeItem(this.metadataKey(baseName));
            } catch {
                // Discarding from the active in-memory queue must not depend on storage.
            }
            this.latestGenerationByMetadataKey.delete(this.metadataKey(tokenName));
            this.latestGenerationByMetadataKey.delete(this.metadataKey(baseName));
            return;
        }
        this.schedule(tokenName, change!, kind as PendingTokenSave['kind'], previousTokenName);
    }

    private restorePending() {
        const restoredOperations = Object.entries(pendingDraftTokens(this.snapshot.designSystem.name, '0.1.0')).map(
            ([tokenName, change]) => {
                const stored = this.readMetadata(this.metadataKey(tokenName));
                const storedKind = stored?.kind;
                if ([typeof stored?.tokenName === 'string', storedMutationKinds.has(storedKind ?? '')].every(Boolean)) {
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
                        : this.tokenIds[tokenName.replace(/^(light|dark)\./, '')]
                          ? ('update' as const)
                          : ('create' as const),
                };
            },
        );
        restoredOperations
            .sort((left, right) => Number(right.kind === 'rename') - Number(left.kind === 'rename'))
            .forEach((operation) =>
                this.schedule(operation.tokenName, operation.change, operation.kind, operation.previousTokenName),
            );
    }
}
