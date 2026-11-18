import { isAxiosError } from 'axios';

/** Повторяем только сетевые сбои и временные ошибки сервера; конфликт требует нового чтения данных. */
export const isRetryableAutosaveError = (error: unknown) =>
    isAxiosError(error) && (!error.response || error.response.status >= 500);

/** Сервис отклонил значение иконки, которого нет в каталоге (`400 unknown_icon`). */
export const isUnknownIconError = (error: unknown) =>
    isAxiosError(error) && error.response?.status === 400 && error.response.data?.code === 'unknown_icon';
