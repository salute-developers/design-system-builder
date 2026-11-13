import axios from 'axios';

import { http } from '../../../api/http';
import { apiRoot, readRequest } from '../../../api/editorHttp';
import { subjectMutation, subjectMutationHeaders } from '../../../api/subjectMutation';

const tokenMutation = <T>(context: Parameters<typeof subjectMutation>[0], operation: () => Promise<T>) =>
    subjectMutation(context, operation, undefined, ['typography', 'fontFamily'], (response) => {
        const data = (response as { data?: import('../domain').UpdatedTypographyStyle }).data;
        return data?.tokens?.length
            ? data.tokens.map((token) => ({ tokenId: token.tokenId, values: token.values }))
            : undefined;
    });
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

/** Ответ создания, переименования и удаления стиля: токены стиля. */
interface StyleTokens {
    tokenIds: string[];
}

const stylesPath = ({ projectId, designSystemId, tenantId }: TypographyContext, suffix = '') =>
    `/api/projects/${projectId}/design-systems/${designSystemId}/tenants/${tenantId}/typography-styles${suffix}`;

const groupsPath = ({ projectId, designSystemId, tenantId }: TypographyContext, group: string) =>
    `/api/projects/${projectId}/design-systems/${designSystemId}/tenants/${tenantId}/typography-groups/${encodeURIComponent(group)}`;

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
            tokenMutation(context, () =>
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
    create: async (context, group, size) => {
        // Ключ повторяемости — на каждое создание: повтор запроса не создаёт стиль дважды.
        const headers = subjectMutationHeaders();
        const data = await call(() =>
            subjectMutation(context, () => http.post<StyleTokens>(stylesPath(context), { group, size }, { headers })),
        );
        return data.tokenIds;
    },
    rename: async (context, tokenId, size) => {
        const path = stylesPath(context, `/${encodeURIComponent(tokenId)}/name`);
        const data = await call(() =>
            subjectMutation(context, () =>
                http.patch<StyleTokens>(path, { size }, { headers: subjectMutationHeaders() }),
            ),
        );
        return data.tokenIds;
    },
    remove: async (context, tokenId) => {
        const path = stylesPath(context, `/${encodeURIComponent(tokenId)}`);
        const data = await call(() =>
            subjectMutation(context, () => http.delete<StyleTokens>(path, { headers: subjectMutationHeaders() })),
        );
        return data.tokenIds;
    },
    renameGroup: async (context, group, name) => {
        const path = groupsPath(context, group);
        const data = await call(() =>
            subjectMutation(context, () =>
                http.patch<StyleTokens>(path, { name }, { headers: subjectMutationHeaders() }),
            ),
        );
        return data.tokenIds;
    },
    removeGroup: async (context, group) => {
        const path = groupsPath(context, group);
        const data = await call(() =>
            subjectMutation(context, () => http.delete<StyleTokens>(path, { headers: subjectMutationHeaders() })),
        );
        return data.tokenIds;
    },
    describe: async (context, tokenId, description) => {
        await call(() =>
            subjectMutation(context, () =>
                http.patch(
                    `${apiRoot(context.projectId, context.designSystemId)}/tokens/${encodeURIComponent(tokenId)}`,
                    { description: description || null },
                    { headers: subjectMutationHeaders() },
                ),
            ),
        );
    },
});
