import axios from 'axios';

import { http } from '../../../api/http';
import { subjectMutation, subjectMutationHeaders } from '../../../api/subjectMutation';
import { subjectBaseRevision } from '../../../api/subjectRevisions';
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
    const details = {
        ...(body.details ?? {}),
        ...(body.editRevision === undefined ? {} : { editRevision: body.editRevision }),
    };
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

const mutate = <T>(
    ctx: PaletteContext,
    subject: { address: string; entityType: string } | undefined,
    operation: (headers: ReturnType<typeof subjectMutationHeaders>) => Promise<{ data: T }>,
) =>
    call(() =>
        subjectMutation(
            ctx,
            () => operation(subjectMutationHeaders(subject ? subjectBaseRevision(ctx, subject.address) : 0)),
            subject,
        ),
    );
const groupSubject = (id: string) => ({ address: `palette:group/${id}`, entityType: 'palette-group' });
const rampSubject = (groupId: string, slot: PaletteRampRef) => ({
    address: `palette:ramp/${groupId}/${slot.type}/${slot.shade}`,
    entityType: 'palette-ramp',
});

/** Адаптер `api`: контракт палитры темы `ds-service` через gateway. */
export const createHttpPaletteRepository = (): PaletteRepository => ({
    source: 'api',
    load: (ctx, signal) =>
        call(() =>
            http.get(palettePath(ctx), { signal, params: ctx.versionId ? { versionId: ctx.versionId } : undefined }),
        ),
    links: (ctx, { slot, groupId, step }) =>
        call(() =>
            http.get(palettePath(ctx, '/links'), {
                params: { type: slot.type, shade: slot.shade, groupId, step, versionId: ctx.versionId },
            }),
        ),
    createGroup: (ctx, label, editRevision) =>
        mutate(ctx, undefined, (headers) =>
            http.post(palettePath(ctx, '/groups'), { label, editRevision }, { headers }),
        ),
    renameGroup: (ctx, groupId, label, editRevision) =>
        mutate(ctx, groupSubject(groupId), (headers) =>
            http.patch(
                palettePath(ctx, `/groups/${encodeURIComponent(groupId)}`),
                { label, editRevision },
                { headers },
            ),
        ),
    deleteGroup: (ctx, groupId, editRevision) =>
        mutate(ctx, groupSubject(groupId), (headers) =>
            http.delete(palettePath(ctx, `/groups/${encodeURIComponent(groupId)}`), {
                data: { editRevision },
                headers,
            }),
        ),
    assignTokenGroup: (ctx, tokenId, groupId, editRevision) =>
        mutate(ctx, { address: `palette:assignment/${tokenId}`, entityType: 'palette-token-group' }, (headers) =>
            http.put(
                palettePath(ctx, `/token-groups/${encodeURIComponent(tokenId)}`),
                { groupId, editRevision },
                { headers },
            ),
        ),
    addRamp: (ctx, groupId, slot, editRevision) =>
        mutate(ctx, rampSubject(groupId, slot), (headers) =>
            http.post(
                palettePath(ctx, `/groups/${encodeURIComponent(groupId)}/ramps`),
                { ...rampRef(slot), editRevision },
                { headers },
            ),
        ),
    replaceSource: (ctx, groupId, slot, source, editRevision) =>
        mutate(ctx, rampSubject(groupId, slot), (headers) =>
            http.put(
                palettePath(ctx, `${rampPath(groupId, slot)}/source`),
                { ...rampRef(source), editRevision },
                { headers },
            ),
        ),
    rebuild: (ctx, groupId, slot, input) =>
        input.preview
            ? call(() =>
                  http.post(palettePath(ctx, `${rampPath(groupId, slot)}/rebuild`), input, {
                      params: { versionId: ctx.versionId },
                  }),
              )
            : mutate(ctx, rampSubject(groupId, slot), (headers) =>
                  http.post(palettePath(ctx, `${rampPath(groupId, slot)}/rebuild`), input, { headers }),
              ),
    updateStep: (ctx, groupId, slot, step, value, editRevision) =>
        mutate(
            ctx,
            { address: `palette:step/${groupId}/${slot.type}/${slot.shade}/${step}`, entityType: 'palette-step' },
            (headers) =>
                http.patch(
                    palettePath(ctx, `${rampPath(groupId, slot)}/steps/${step}`),
                    { value, editRevision },
                    { headers },
                ),
        ),
    removeRamp: (ctx, groupId, slot, { strategy, replacement, editRevision }) =>
        mutate(ctx, rampSubject(groupId, slot), (headers) =>
            http.delete(palettePath(ctx, rampPath(groupId, slot)), {
                data: { strategy, replacement: replacement && rampRef(replacement), editRevision },
                headers,
            }),
        ),
});
