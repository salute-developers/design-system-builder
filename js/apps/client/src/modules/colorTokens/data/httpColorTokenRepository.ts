import axios from 'axios';

import { http } from '../../../api/http';
import {
    ColorTokenOperationError,
    type ColorTokenContext,
    type ColorTokenRepository,
} from '../application/colorTokenRepository';

const tokensPath = ({ projectId, tenantId }: ColorTokenContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/color-tokens${suffix}`;

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

const call = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toError(error);
    }
};

/** Операции над цветовым токеном `ds-service` через gateway. */
export const createHttpColorTokenRepository = (): ColorTokenRepository => ({
    create: (context, input, editRevision) => call(() => http.post(tokensPath(context), { ...input, editRevision })),
    updateValues: (context, tokenId, update, editRevision) =>
        call(() =>
            http.put(tokensPath(context, `/${encodeURIComponent(tokenId)}/values`), { ...update, editRevision }),
        ),
    delete: (context, tokenId, editRevision) =>
        call(() => http.delete(tokensPath(context, `/${encodeURIComponent(tokenId)}`), { data: { editRevision } })),
});
