import type { CreateSizeTokenRequest, SizeToken, SizeTokens, SizeTokenValue, WrittenValue } from '../domain';

/** Тема, в которой выполняются операции над токенами размеров. */
export interface SizeTokenContext {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}

/** Ответ изменения значения: новая ревизия темы, токен в формате чтения и записанные значения платформ. */
export interface UpdatedSizeToken {
    editRevision: number;
    token: SizeToken;
    values: WrittenValue[];
}

/** Ответ создания: у тени — четыре варианта размера. */
export interface CreatedSizeTokens {
    editRevision: number;
    created: SizeToken[];
}

export interface DeletedSizeTokens {
    editRevision: number;
    deletedTokenIds: string[];
}

/** Порт токенов размеров `ds-service`; каждая операция изменения сверяет и увеличивает ревизию темы. */
export interface SizeTokenRepository {
    load(context: SizeTokenContext): Promise<SizeTokens>;
    updateValue(
        context: SizeTokenContext,
        tokenId: string,
        value: SizeTokenValue,
        editRevision: number,
    ): Promise<UpdatedSizeToken>;
    create(
        context: SizeTokenContext,
        request: CreateSizeTokenRequest,
        editRevision: number,
    ): Promise<CreatedSizeTokens>;
    delete(context: SizeTokenContext, tokenId: string, editRevision: number): Promise<DeletedSizeTokens>;
}

export type SizeTokenErrorKind = 'conflict' | 'forbidden' | 'invalid' | 'not-found' | 'network';

/** Отказ операции над токеном размеров в терминах экрана. */
export class SizeTokenOperationError extends Error {
    readonly kind: SizeTokenErrorKind;
    readonly code: string | null;
    /** Поле недопустимого значения у `INVALID_SIZE_VALUE`: `valuePx`, `layers[0].blur`, `platforms.android`. */
    readonly field: string | null;
    /** Актуальная ревизия темы у `TENANT_EDIT_CONFLICT`. */
    readonly editRevision: number | null;

    constructor(
        kind: SizeTokenErrorKind,
        message: string,
        code: string | null = null,
        field: string | null = null,
        editRevision: number | null = null,
    ) {
        super(message);
        this.name = 'SizeTokenOperationError';
        this.kind = kind;
        this.code = code;
        this.field = field;
        this.editRevision = editRevision;
    }
}
