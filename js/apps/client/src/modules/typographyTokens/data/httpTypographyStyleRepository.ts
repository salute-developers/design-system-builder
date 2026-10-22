import axios from 'axios';

import { http } from '../../../api/http';
import { readRequest } from '../../../api/editorHttp';
import { subjectMutation } from '../../../api/subjectMutation';
import { tokenValueBaseRevision } from '../../../api/subjectRevisions';
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
}

const stylesPath = ({ projectId, tenantId }: TypographyContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/typography-styles${suffix}`;

const toError = (error: unknown) => {
    if (error instanceof TypographyOperationError) return error;
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
        status === 403
            ? 'forbidden'
            : status === 404
              ? 'not-found'
              : status === 409 && code === 'TYPOGRAPHY_VALUES_MISSING'
                ? 'missing-values'
                : status >= 500
                  ? 'network'
                  : 'invalid';
    return new TypographyOperationError(kind, message, code, field);
};

const call = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toError(error);
    }
};

/** Стили типографии `ds-service` через gateway: чтение на границе версии и правка через предметные мутации. */
export const createHttpTypographyStyleRepository = (): TypographyStyleRepository => ({
    load: (context, signal) => call(() => http.get(stylesPath(context), readRequest(context, signal))),
    update: (context, tokenId, change, values) =>
        call(() =>
            subjectMutation(context, () =>
                http.patch(stylesPath(context, `/${encodeURIComponent(tokenId)}`), {
                    ...change,
                    // Редакции берутся в момент отправки: их обновили метаданные предыдущих подтверждённых операций.
                    baseRevisions: values.map(({ tokenId: valueToken, platform }) => ({
                        tokenId: valueToken,
                        platform,
                        baseRevision: tokenValueBaseRevision(context, valueToken, platform, ''),
                    })),
                }),
            ),
        ),
});
