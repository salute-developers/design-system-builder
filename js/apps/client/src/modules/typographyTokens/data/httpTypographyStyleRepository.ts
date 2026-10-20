import axios from 'axios';

import { http } from '../../../api/http';
import type { TypographyField } from '../domain';
import {
    TypographyOperationError,
    type TypographyContext,
    type TypographyStyleRepository,
} from '../application/typographyStyleRepository';

interface ErrorBody {
    error?: unknown;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
    editRevision?: number;
}

const stylesPath = ({ projectId, tenantId }: TypographyContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/typography-styles${suffix}`;

const toError = (error: unknown) => {
    if (!axios.isAxiosError<ErrorBody>(error) || !error.response) {
        return new TypographyOperationError('network', 'Сервис недоступен, изменения не сохранены');
    }
    const { status, data: body = {} } = error.response;
    const message =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Ошибка API (${status})`;
    const code = typeof body.code === 'string' ? body.code : null;
    const field = typeof body.details?.field === 'string' ? (body.details.field as TypographyField) : null;
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
    return new TypographyOperationError(kind, message, code, field, body.editRevision ?? null);
};

const call = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toError(error);
    }
};

/** Стили типографии `ds-service` через gateway. */
export const createHttpTypographyStyleRepository = (): TypographyStyleRepository => ({
    load: (context) => call(() => http.get(stylesPath(context))),
    update: (context, tokenId, change, editRevision) =>
        call(() => http.patch(stylesPath(context, `/${encodeURIComponent(tokenId)}`), { ...change, editRevision })),
});
