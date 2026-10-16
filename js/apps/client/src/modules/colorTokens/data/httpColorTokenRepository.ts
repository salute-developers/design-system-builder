import { http } from '../../../api/http';
import type { ColorTokenContext, ColorTokenRepository } from '../application/colorTokenRepository';
import { callOperation as call } from './httpOperation';

const tokensPath = ({ projectId, tenantId }: ColorTokenContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/color-tokens${suffix}`;

/** Операции над цветовым токеном `ds-service` через gateway. */
export const createHttpColorTokenRepository = (): ColorTokenRepository => ({
    create: (context, input, editRevision) => call(() => http.post(tokensPath(context), { ...input, editRevision })),
    updateValues: (context, tokenId, update, editRevision) =>
        call(() =>
            http.put(tokensPath(context, `/${encodeURIComponent(tokenId)}/values`), { ...update, editRevision }),
        ),
    delete: (context, tokenId, editRevision) =>
        call(() => http.delete(tokensPath(context, `/${encodeURIComponent(tokenId)}`), { data: { editRevision } })),
    move: (context, tokenId, input, editRevision) =>
        call(() => http.post(tokensPath(context, `/${encodeURIComponent(tokenId)}/move`), { ...input, editRevision })),
});
