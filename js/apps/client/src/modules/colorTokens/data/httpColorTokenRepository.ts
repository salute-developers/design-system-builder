import { http } from '../../../api/http';
import type { ColorTokenContext, ColorTokenRepository } from '../application/colorTokenRepository';
import { callOperation as call } from './httpOperation';
import { subjectMutation, subjectMutationHeaders } from '../../../api/subjectMutation';
import { tokenValueBaseRevision } from '../../../api/subjectRevisions';
import { normalizedColorValue } from '../../../api/colorValue';

const tokensPath = ({ projectId, tenantId }: ColorTokenContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/color-tokens${suffix}`;

/** Операции над цветовым токеном `ds-service` через gateway. */
export const createHttpColorTokenRepository = (): ColorTokenRepository => ({
    create: (context, input, editRevision) =>
        call(() =>
            subjectMutation(context, () =>
                http.post(tokensPath(context), { ...input, editRevision }, { headers: subjectMutationHeaders() }),
            ),
        ),
    updateValues: (context, tokenId, update, editRevision) =>
        call(() =>
            subjectMutation(context, () =>
                http.put(
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
                ),
            ),
        ),
    delete: (context, tokenId, editRevision) =>
        call(() =>
            subjectMutation(context, () =>
                http.delete(tokensPath(context, `/${encodeURIComponent(tokenId)}`), {
                    data: { editRevision },
                    headers: subjectMutationHeaders(),
                }),
            ),
        ),
    move: (context, tokenId, input, editRevision) =>
        call(() =>
            subjectMutation(context, () =>
                http.post(
                    tokensPath(context, `/${encodeURIComponent(tokenId)}/move`),
                    { ...input, editRevision },
                    { headers: subjectMutationHeaders() },
                ),
            ),
        ),
});
