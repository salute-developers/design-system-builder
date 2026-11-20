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

/** Сервис отклонил значение иконки, которого нет в каталоге (`400 unknown_icon`). */
export const isUnknownIconError = (error: unknown) =>
    isAxiosError(error) && error.response?.status === 400 && error.response.data?.code === 'unknown_icon';
