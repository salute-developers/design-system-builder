import { colorValueConfirmation, colorStructureConfirmation } from '../../../api/incompleteMutationMetadata';
import { observeConfirmedTokenValues } from '../../../api/subjectRevisions';
import { readEditor } from '../../../api/editorReads';
import { parseMutationMetadata } from '../../../api/editorHttp';
import type { TenantTokenValueDto } from '../../../api/editorContracts';
import type { ConfirmedTokenValues } from '../../../api/draftAutosaveActivity';
import { http } from '../../../api/http';
import type { ColorTokenContext, ColorTokenRepository } from '../application/colorTokenRepository';
import { callOperation as call } from './httpOperation';
import { subjectMutation, subjectMutationHeaders } from '../../../api/subjectMutation';

import { tokenValueBaseRevision } from '../../../api/subjectRevisions';
import { normalizedColorValue } from '../../../api/colorValue';

const confirmedValues = (
    context: ColorTokenContext,
    values: TenantTokenValueDto[],
    type?: 'color' | 'gradient',
    update?: Parameters<ColorTokenRepository['updateValues']>[2],
): ConfirmedTokenValues[] => {
    observeConfirmedTokenValues(context, values);
    return [...new Set(values.map((value) => value.tokenId))].map((id) => ({
        tokenId: id,
        type,
        values: values
            .filter((value) => value.tokenId === id)
            .map((value) => ({
                entityId: value.id,
                revision: value.editRevision,
                platform: value.platform!,
                mode: value.mode,
                value: value.paletteRef ?? value.sourceValue ?? value.value,
                overridden:
                    value.overridden ??
                    update?.members
                        .find((member) => member.tokenId === id)
                        ?.values.find((item) => item.platform === value.platform && item.mode === value.mode)
                        ?.overridden,
            })),
    }));
};
const tokenMutation = <T extends { data: unknown }>(
    context: ColorTokenContext,
    url: string,
    operation: () => Promise<T>,
    paletteGroupId?: string | null,
) =>
    subjectMutation(
        context,
        operation,
        undefined,
        undefined,
        (response) => {
            const data = response.data as {
                confirmedValues?: TenantTokenValueDto[];
                value?: { type?: 'color' | 'gradient' };
            };
            const values = data.confirmedValues;
            return values?.length &&
                values.every(
                    (value) =>
                        value.tenantId === context.tenantId &&
                        value.platform &&
                        Number.isSafeInteger(value.editRevision) &&
                        (!value.paletteId || value.paletteRef),
                )
                ? confirmedValues(context, values, data.value?.type)
                : undefined;
        },
        (response) => {
            const structure = colorStructureConfirmation({ ...response, config: { url } });
            return structure ? { ...structure, paletteGroupId } : undefined;
        },
    );

const tokensPath = ({ projectId, tenantId }: ColorTokenContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/color-tokens${suffix}`;

/** Сверка только записанных сущностей по уже существующим mutation metadata и GET-by-id. */
const updateValues = (
    context: ColorTokenContext,
    tokenId: string,
    update: Parameters<ColorTokenRepository['updateValues']>[2],
    editRevision: number,
) =>
    subjectMutation(
        context,
        async () => {
            const response = await http.put<{
                editRevision: number;
                type?: 'color' | 'gradient';
                confirmedValues?: TenantTokenValueDto[];
            }>(
                tokensPath(context, `/${encodeURIComponent(tokenId)}/values`),
                {
                    members: update.members.map((member) => ({
                        ...member,
                        values: member.values.map((value) => ({
                            ...value,
                            value: normalizedColorValue(value.value),
                            baseRevision:
                                value.baseRevision ??
                                tokenValueBaseRevision(context, member.tokenId, value.platform, value.mode),
                        })),
                    })),
                    editRevision,
                },
                { headers: subjectMutationHeaders() },
            );
            const ids = [
                ...new Set(
                    parseMutationMetadata(response.headers?.['x-ds-mutation-metadata'])
                        .filter((item) => item.entityType === 'token-value')
                        .map((item) => item.entityId),
                ),
            ];
            let confirmed: ConfirmedTokenValues[] | undefined;
            const bodyValues = colorValueConfirmation({
                ...response,
                config: { url: tokensPath(context, `/${encodeURIComponent(tokenId)}/values`) },
            });
            if (bodyValues || (ids.length && response.headers?.['x-ds-mutation-metadata-truncated'] !== 'true')) {
                try {
                    const tokenIds = [...new Set(update.members.map((member) => member.tokenId))];
                    const values =
                        bodyValues ??
                        (
                            await Promise.all(
                                tokenIds.map(
                                    async (id) =>
                                        (
                                            await readEditor<TenantTokenValueDto[]>(
                                                `/api/projects/${context.projectId}/ds/tokens/${encodeURIComponent(id)}/values`,
                                                { params: { tenantId: context.tenantId } },
                                            )
                                        ).data,
                                ),
                            )
                        ).flat();
                    if (
                        values.every(
                            (value) =>
                                value.tenantId === context.tenantId &&
                                value.platform &&
                                (!value.paletteId || value.paletteRef),
                        )
                    ) {
                        confirmed = confirmedValues(context, values, response.data.type, update);
                    }
                } catch {
                    // PUT уже подтверждён: отказ чтения не превращает его в повторную запись.
                    // Общая сверка активного раздела остаётся консервативным fallback.
                }
            }
            return { ...response, confirmed };
        },
        undefined,
        ['color', 'gradient'],
        (response) => response.confirmed,
    );

/** Операции над цветовым токеном `ds-service` через gateway. */
export const createHttpColorTokenRepository = (): ColorTokenRepository => ({
    create: (context, input, editRevision) =>
        call(() =>
            tokenMutation(
                context,
                tokensPath(context),
                () => http.post(tokensPath(context), { ...input, editRevision }, { headers: subjectMutationHeaders() }),
                input.paletteGroupId,
            ),
        ),
    updateValues: (context, tokenId, update, editRevision) =>
        call(() => updateValues(context, tokenId, update, editRevision)),
    delete: (context, tokenId, editRevision) =>
        call(() =>
            tokenMutation(context, tokensPath(context, `/${encodeURIComponent(tokenId)}`), () =>
                http.delete(tokensPath(context, `/${encodeURIComponent(tokenId)}`), {
                    data: { editRevision },
                    headers: subjectMutationHeaders(),
                }),
            ),
        ),
    move: (context, tokenId, input, editRevision) =>
        call(() =>
            tokenMutation(context, tokensPath(context, `/${encodeURIComponent(tokenId)}/move`), () =>
                http.post(
                    tokensPath(context, `/${encodeURIComponent(tokenId)}/move`),
                    { ...input, editRevision },
                    { headers: subjectMutationHeaders() },
                ),
            ),
        ),
});
