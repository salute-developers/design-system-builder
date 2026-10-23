import type { EditorContextKey } from '../../../api/editorContracts';
import type { CreateSizeTokenRequest, SizeToken, SizeTokens, SizeTokenValue, WrittenValue } from '../domain';

/** Тема, в которой читаются и меняются токены размеров; `versionId` — опубликованная версия только для чтения. */
export type SizeTokenContext = EditorContextKey;

/** Операция над токенами размеров в терминах экрана. */
export type SizeTokenOperation =
    | { type: 'update'; tokenId: string; value: SizeTokenValue }
    | { type: 'create'; request: CreateSizeTokenRequest }
    | { type: 'delete'; tokenId: string };

/**
 * Исходная команда операции `size-tokens`: метод, путь, тело с `platforms` и базовыми редакциями и ключ
 * повторяемости. В таком виде неподтверждённая операция хранится в `localStorage` темы и повторяется при следующем
 * открытии темы той же командой.
 */
export interface SizeTokenCommand {
    /** Поколение команды: подтверждение старого поколения не снимает более новое. */
    id: string;
    operation: SizeTokenOperation['type'];
    method: 'PUT' | 'POST' | 'DELETE';
    /** Путь через gateway: `/api/projects/{projectId}/ds/tenants/{tenantId}/size-tokens…`. */
    path: string;
    body?: unknown;
    /** `Idempotency-Key` создания: повтор возвращает сохранённый ответ, токен не создаётся дважды. */
    idempotencyKey?: string;
    /** Токен изменения или удаления. */
    tokenId?: string;
}

/** Ответ изменения значения: токен в формате чтения и записанные значения платформ. */
export interface UpdatedSizeToken {
    type: 'update';
    token: SizeToken;
    values: WrittenValue[];
}

/** Ответ создания: у тени — четыре варианта размера. */
export interface CreatedSizeTokens {
    type: 'create';
    created: SizeToken[];
}

/** Ответ удаления: у тени — четыре варианта размера. */
export interface DeletedSizeTokens {
    type: 'delete';
    deletedTokenIds: string[];
}

export type SizeTokenResult = UpdatedSizeToken | CreatedSizeTokens | DeletedSizeTokens;

/**
 * Порт токенов размеров `ds-service`. Изменяющие операции идут общим механизмом предметных мутаций редактора:
 * технические редакции ответа принимаются из `X-DS-Mutation-Metadata`, общего счётчика темы нет.
 */
export interface SizeTokenRepository {
    load(context: SizeTokenContext, signal?: AbortSignal): Promise<SizeTokens>;
    /** Команда операции с базовыми редакциями значений, известными клиенту в момент вызова. */
    command(context: SizeTokenContext, operation: SizeTokenOperation): SizeTokenCommand;
    /** Отправляет команду как есть: так же отправляется и команда, сохранённая до перезагрузки. */
    send(context: SizeTokenContext, command: SizeTokenCommand): Promise<SizeTokenResult>;
}

/** Неподтверждённые команды темы: переживают закрытие страницы и повторяются при следующем открытии темы. */
export interface PendingSizeTokenCommands {
    save(key: string, command: SizeTokenCommand): void;
    /** Убирает команду [key]; с [commandId] — только если хранится это поколение. */
    remove(key: string, commandId?: string): void;
    list(): Array<{ key: string; command: SizeTokenCommand }>;
}

export type SizeTokenErrorKind = 'forbidden' | 'invalid' | 'not-found' | 'network' | 'failed';

/** Отказ операции над токеном размеров в терминах экрана. */
export class SizeTokenOperationError extends Error {
    readonly kind: SizeTokenErrorKind;
    readonly code: string | null;
    /** Поле недопустимого значения у `INVALID_SIZE_VALUE`: `valuePx`, `layers[0].blur`, `platforms.android`. */
    readonly field: string | null;

    constructor(kind: SizeTokenErrorKind, message: string, code: string | null = null, field: string | null = null) {
        super(message);
        this.name = 'SizeTokenOperationError';
        this.kind = kind;
        this.code = code;
        this.field = field;
    }

    /** Ошибка сети или `5xx`: операцию повторяем автоматически с увеличивающейся задержкой. */
    get retryable() {
        return this.kind === 'network';
    }
}
