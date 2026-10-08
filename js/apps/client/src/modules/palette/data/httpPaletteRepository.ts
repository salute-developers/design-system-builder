import axios from 'axios';

import { http } from '../../../api/http';
import { PaletteOperationError, type PaletteErrorCode, type PaletteRampRef } from '../domain';
import type { PaletteContext, PaletteRepository } from '../application/paletteRepository';

const palettePath = ({ projectId, tenantId }: PaletteContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/palette${suffix}`;

/** Только `{ type, shade }`: сервер не принимает лишних полей, а из UI сюда приходят растяжки шаблона со ступенями. */
const rampRef = ({ type, shade }: PaletteRampRef): PaletteRampRef => ({ type, shade });

const rampPath = (groupId: string, { type, shade }: PaletteRampRef) =>
    `/groups/${encodeURIComponent(groupId)}/ramps/${type}/${encodeURIComponent(shade)}`;

interface ErrorBody {
    /** Строка или, у 400, объект проверки полей. */
    error?: unknown;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
    editRevision?: number;
}

const toPaletteError = (error: unknown) => {
    if (!axios.isAxiosError<ErrorBody>(error)) return new PaletteOperationError(null, null, 'Сервис недоступен');
    const status = error.response?.status;
    const body = error.response?.data ?? {};
    const details = { ...(body.details ?? {}), ...(body.editRevision === undefined ? {} : { editRevision: body.editRevision }) };
    return new PaletteOperationError(
        status === 400 || status === 404 || status === 409 ? status : null,
        (body.code as PaletteErrorCode | undefined) ?? null,
        // Пользователю — только строковый текст: у 400 `error` бывает объектом проверки полей.
        (typeof body.message === 'string' && body.message) ||
            (typeof body.error === 'string' && body.error) ||
            (status ? `Ошибка API (${status})` : 'Сервис недоступен'),
        details,
    );
};

const call = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toPaletteError(error);
    }
};

/** Адаптер `api`: контракт палитры темы `ds-service` через gateway. */
export const createHttpPaletteRepository = (): PaletteRepository => ({
    source: 'api',
    load: (ctx, signal) => call(() => http.get(palettePath(ctx), { signal })),
    links: (ctx, { slot, groupId, step }) =>
        call(() =>
            http.get(palettePath(ctx, '/links'), {
                params: { type: slot.type, shade: slot.shade, groupId, step },
            }),
        ),
    createGroup: (ctx, label, editRevision) => call(() => http.post(palettePath(ctx, '/groups'), { label, editRevision })),
    renameGroup: (ctx, groupId, label, editRevision) =>
        call(() => http.patch(palettePath(ctx, `/groups/${encodeURIComponent(groupId)}`), { label, editRevision })),
    deleteGroup: (ctx, groupId, editRevision) =>
        call(() =>
            http.delete(palettePath(ctx, `/groups/${encodeURIComponent(groupId)}`), { data: { editRevision } }),
        ),
    assignTokenGroup: (ctx, tokenId, groupId, editRevision) =>
        call(() =>
            http.put(palettePath(ctx, `/token-groups/${encodeURIComponent(tokenId)}`), { groupId, editRevision }),
        ),
    addRamp: (ctx, groupId, slot, editRevision) =>
        call(() =>
            http.post(palettePath(ctx, `/groups/${encodeURIComponent(groupId)}/ramps`), { ...rampRef(slot), editRevision }),
        ),
    replaceSource: (ctx, groupId, slot, source, editRevision) =>
        call(() => http.put(palettePath(ctx, `${rampPath(groupId, slot)}/source`), { ...rampRef(source), editRevision })),
    rebuild: (ctx, groupId, slot, input) =>
        call(() => http.post(palettePath(ctx, `${rampPath(groupId, slot)}/rebuild`), input)),
    updateStep: (ctx, groupId, slot, step, value, editRevision) =>
        call(() => http.patch(palettePath(ctx, `${rampPath(groupId, slot)}/steps/${step}`), { value, editRevision })),
    removeRamp: (ctx, groupId, slot, { strategy, replacement, editRevision }) =>
        call(() =>
            http.delete(palettePath(ctx, rampPath(groupId, slot)), {
                data: { strategy, replacement: replacement && rampRef(replacement), editRevision },
            }),
        ),
});
