import { isAxiosError } from 'axios';

/** Повторяем только сетевые сбои и временные ошибки сервера; конфликт требует нового чтения данных. */
export const isRetryableAutosaveError = (error: unknown) =>
    isAxiosError(error) && (!error.response || error.response.status >= 500);

/**
 * Причина отказа сохранения для пользователя: русское сообщение ошибки, которое подготовил репозиторий (например,
 * отказ проверки ссылки на стиль). Технические английские тексты не показываются.
 */
export const autosaveErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error && /[А-Яа-яЁё]/.test(error.message) ? error.message : undefined;

/** Сервис отклонил значение иконки, которого нет в каталоге (`400 unknown_icon`). */
export const isUnknownIconError = (error: unknown) =>
    isAxiosError(error) && error.response?.status === 400 && error.response.data?.code === 'unknown_icon';
