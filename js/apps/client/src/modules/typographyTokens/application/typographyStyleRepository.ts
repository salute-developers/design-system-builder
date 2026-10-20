import type { TypographyField, TypographyStyleChange, TypographyStyles, UpdatedTypographyStyle } from '../domain';

/** Тема, стили которой читаются и меняются. */
export interface TypographyContext {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}

/** Порт стилей типографии; изменение сверяет и увеличивает общую ревизию темы. */
export interface TypographyStyleRepository {
    load(context: TypographyContext): Promise<TypographyStyles>;
    update(
        context: TypographyContext,
        tokenId: string,
        change: TypographyStyleChange,
        editRevision: number,
    ): Promise<UpdatedTypographyStyle>;
}

export type TypographyErrorKind = 'conflict' | 'forbidden' | 'invalid' | 'not-found' | 'network';

/** Отказ операции над стилем в терминах экрана. */
export class TypographyOperationError extends Error {
    readonly kind: TypographyErrorKind;
    readonly code: string | null;
    /** Поле запроса у `INVALID_TYPOGRAPHY_VALUE`. */
    readonly field: TypographyField | null;
    /** Актуальная ревизия темы у `TENANT_EDIT_CONFLICT`. */
    readonly editRevision: number | null;

    constructor(
        kind: TypographyErrorKind,
        message: string,
        code: string | null = null,
        field: TypographyField | null = null,
        editRevision: number | null = null,
    ) {
        super(message);
        this.name = 'TypographyOperationError';
        this.kind = kind;
        this.code = code;
        this.field = field;
        this.editRevision = editRevision;
    }
}
