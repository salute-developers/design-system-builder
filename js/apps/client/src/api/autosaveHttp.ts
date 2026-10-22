import { isAxiosError } from 'axios';

/** Повторяем только сетевые сбои и временные ошибки сервера; конфликт требует нового чтения данных. */
export const isRetryableAutosaveError = (error: unknown) =>
    isAxiosError(error) && (!error.response || error.response.status >= 500);
