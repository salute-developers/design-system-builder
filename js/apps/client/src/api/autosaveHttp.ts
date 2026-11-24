import { isAxiosError } from 'axios';

/** Повторяем только сетевые сбои и временные ошибки сервера; конфликт требует нового чтения данных. */
export const isRetryableAutosaveError = (error: unknown) =>
    isAxiosError(error) && (!error.response || error.response.status >= 500);

/**
 * Отказ сохранения с причиной, понятной пользователю (например, отказ проверки ссылки на стиль). Индикатор
 * автосохранения показывает текст только таких ошибок; `source` — исходная ошибка запроса.
 */
export class AutosaveRejection extends Error {
    readonly source: unknown;

    constructor(message: string, source?: unknown) {
        super(message);
        this.name = 'AutosaveRejection';
        this.source = source;
    }
}

/** Причина отказа сохранения для пользователя; у прочих ошибок её нет. */
export const autosaveErrorMessage = (error: unknown): string | undefined =>
    error instanceof AutosaveRejection ? error.message : undefined;

/** Общая проверка HTTP-отказа, включая исходную ошибку внутри пользовательского объяснения. */
const hasAutosaveHttpError = (error: unknown, status: number, code: string) => {
    const source = error instanceof AutosaveRejection ? error.source : error;
    if (!isAxiosError(source)) return false;
    const response = source.response;
    return response?.status === status && [response.data?.code, response.data?.error].includes(code);
};

/** Сервис отклонил значение иконки, которого нет в каталоге (`400 unknown_icon`). */
export const isUnknownIconError = (error: unknown) => hasAutosaveHttpError(error, 400, 'unknown_icon');

/** Сервер сменил Core после чтения модели: сохранённая операция требует явного восстановления. */
export const isCoreSelectionStaleError = (error: unknown) => hasAutosaveHttpError(error, 409, 'CORE_SELECTION_STALE');

/** Тексты отказов записи значения по признаку поддержки состояний свойства (`422`). */
const STATE_REJECTIONS: Record<string, string> = {
    states_not_supported: 'Свойство не поддерживает это состояние на платформе',
    state_not_in_component: 'Состояние принадлежит другому компоненту',
};

/**
 * Отказ записи значения по признаку поддержки состояний. Повтор его не исправит: редактор отбрасывает правку,
 * перечитывает компонент (прежнее значение возвращается) и показывает причину.
 */
export class StateRejection extends AutosaveRejection {
    constructor(message: string, source?: unknown) {
        super(message, source);
        this.name = 'StateRejection';
    }
}

export const isStateRejection = (error: unknown): error is StateRejection => error instanceof StateRejection;

/** Отказ `states_not_supported` или `state_not_in_component` как [StateRejection], иначе исходная ошибка. */
export const stateRejection = (error: unknown): unknown => {
    // ds-service кладёт код отказа в поле `error`, `code` — прежняя форма ответа.
    const data = isAxiosError(error) && error.response?.status === 422 ? error.response.data : undefined;
    const message = [data?.error, data?.code]
        .map((code) => (typeof code === 'string' ? STATE_REJECTIONS[code] : undefined))
        .find(Boolean);
    return message ? new StateRejection(message, error) : error;
};
