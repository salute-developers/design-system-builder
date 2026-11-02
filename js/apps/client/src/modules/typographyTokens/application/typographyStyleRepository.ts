import type { EditorContextKey } from '../../../api/editorContracts';
import type {
    TypographyField,
    TypographyStyleChange,
    TypographyStyles,
    TypographyValueAddress,
    UpdatedTypographyStyle,
} from '../domain';

/** Тема, стили которой читаются и меняются; `versionId` — опубликованная версия только для чтения. */
export type TypographyContext = EditorContextKey;

/** Порт стилей типографии; изменение пишет предметные редакции значений с базовыми редакциями из чтения. */
export interface TypographyStyleRepository {
    load(context: TypographyContext, signal?: AbortSignal): Promise<TypographyStyles>;
    /** Меняет стиль токена [tokenId]; [values] — значения стиля, базовые редакции которых передаются серверу. */
    update(
        context: TypographyContext,
        tokenId: string,
        change: TypographyStyleChange,
        values: TypographyValueAddress[],
    ): Promise<UpdatedTypographyStyle>;
    /** Меняет описание токена [tokenId]; пустая строка снимает описание. */
    describe(context: TypographyContext, tokenId: string, description: string): Promise<void>;
    /** Создаёт стиль [group].[size] — девять токенов во всех темах; результат — токены стиля. */
    create(context: TypographyContext, group: string, size: string): Promise<string[]>;
    /** Меняет размер стиля токена [tokenId]; группа не меняется. */
    rename(context: TypographyContext, tokenId: string, size: string): Promise<string[]>;
    /** Удаляет стиль токена [tokenId] со всеми токенами начертаний и экранов. */
    remove(context: TypographyContext, tokenId: string): Promise<string[]>;
}

export type TypographyErrorKind = 'forbidden' | 'invalid' | 'not-found' | 'missing-values' | 'network';

/** Отказ операции над стилем в терминах экрана. */
export class TypographyOperationError extends Error {
    readonly kind: TypographyErrorKind;
    readonly code: string | null;
    /** Поле запроса у `INVALID_TYPOGRAPHY_VALUE`. */
    readonly field: TypographyField | null;

    constructor(
        kind: TypographyErrorKind,
        message: string,
        code: string | null = null,
        field: TypographyField | null = null,
    ) {
        super(message);
        this.name = 'TypographyOperationError';
        this.kind = kind;
        this.code = code;
        this.field = field;
    }

    /** Ошибка сети или `5xx`: правку можно повторить автоматически. */
    get retryable() {
        return this.kind === 'network';
    }
}
