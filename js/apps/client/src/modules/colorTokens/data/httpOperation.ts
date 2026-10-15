import axios from 'axios';

import { ColorTokenOperationError } from '../application/colorTokenRepository';

interface ErrorBody {
    /** Строка или, у 400 с полями, объект проверки полей. */
    error?: unknown;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
    editRevision?: number;
}

const toError = (error: unknown) => {
    if (!axios.isAxiosError<ErrorBody>(error) || !error.response) {
        return new ColorTokenOperationError('network', 'Сервис недоступен, изменения не сохранены');
    }
    const { status, data: body = {} } = error.response;
    const message =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Ошибка API (${status})`;
    const code = typeof body.code === 'string' ? body.code : null;
    const address = typeof body.details?.address === 'string' ? body.details.address : null;
    const kind =
        status === 409 && code === 'TENANT_EDIT_CONFLICT'
            ? 'conflict'
            : status === 403
              ? 'forbidden'
              : status === 404
                ? 'not-found'
                : status >= 500
                  ? 'network'
                  : 'invalid';
    return new ColorTokenOperationError(kind, message, code, address, body.editRevision ?? null);
};

/** Запрос операции `ds-service`: отказ переводится в `ColorTokenOperationError`. */
export const callOperation = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toError(error);
    }
};
