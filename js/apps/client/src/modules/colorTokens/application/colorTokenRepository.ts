import type { ColorMode, ColorTokenType } from '../domain';

/** Тема, в которой выполняются операции над цветовым токеном. */
export interface ColorTokenContext {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}

export type ColorPlatform = 'web' | 'ios' | 'android';

export interface ColorTokenValueItem {
    platform: ColorPlatform;
    mode: ColorMode;
    paletteId?: string | null;
    value: unknown;
}

export interface CreateColorTokenInput {
    type: ColorTokenType;
    group: string;
    name: string;
    displayName?: string | null;
    description?: string | null;
    paletteGroupId?: string | null;
    members: Array<{ name: string; values: ColorTokenValueItem[] }>;
    /** Группа или подгруппа токенов; без неё токен создаётся без группы. */
    groupId?: string | null;
    /** Позиция в группе; без неё — в конец. */
    position?: number | null;
}

export interface MoveColorTokenInput {
    groupId: string;
    position: number;
    /** Новое имя без группы и состояния. */
    name?: string;
}

export interface ColorTokenFamilyDto {
    type: ColorTokenType;
    group: string;
    name: string;
    members: Array<{ tokenId: string; name: string }>;
}

export interface ColorTokenMembersUpdate {
    members: Array<{ tokenId: string; values: ColorTokenValueItem[] }>;
}

/** Порт операций над отдельным цветовым токеном; каждая операция сверяет и увеличивает ревизию темы. */
export interface ColorTokenRepository {
    create(
        context: ColorTokenContext,
        input: CreateColorTokenInput,
        editRevision: number,
    ): Promise<{ editRevision: number; value: ColorTokenFamilyDto }>;
    updateValues(
        context: ColorTokenContext,
        tokenId: string,
        update: ColorTokenMembersUpdate,
        editRevision: number,
    ): Promise<{ editRevision: number }>;
    delete(context: ColorTokenContext, tokenId: string, editRevision: number): Promise<{ editRevision: number }>;
    /** Переносит семейство в группу и на позицию, при `name` — переименовывает; идентификаторы сохраняются. */
    move(
        context: ColorTokenContext,
        tokenId: string,
        input: MoveColorTokenInput,
        editRevision: number,
    ): Promise<{ editRevision: number; value: ColorTokenFamilyDto }>;
}

export type ColorTokenErrorKind = 'conflict' | 'forbidden' | 'invalid' | 'not-found' | 'network';

/** Отказ операции над токеном в терминах экрана. */
export class ColorTokenOperationError extends Error {
    readonly kind: ColorTokenErrorKind;
    readonly code: string | null;
    /** Адрес недопустимого значения `<токен>:<platform>:<mode>` у `INVALID_TOKEN_VALUE`. */
    readonly address: string | null;
    /** Актуальная ревизия темы у `TENANT_EDIT_CONFLICT`. */
    readonly editRevision: number | null;

    constructor(
        kind: ColorTokenErrorKind,
        message: string,
        code: string | null = null,
        address: string | null = null,
        editRevision: number | null = null,
    ) {
        super(message);
        this.name = 'ColorTokenOperationError';
        this.kind = kind;
        this.code = code;
        this.address = address;
        this.editRevision = editRevision;
    }
}
