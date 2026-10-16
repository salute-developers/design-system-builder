import { http } from '../../../api/http';
import type { ColorTokenContext } from '../application/colorTokenRepository';
import type { PlacedDefinition, TokenGroupRepository } from '../application/tokenGroupRepository';
import type { TokenGroupDto } from '../domain';
import { callOperation as call } from './httpOperation';

const root = ({ projectId }: ColorTokenContext) => `/api/projects/${projectId}/ds`;
const groupsPath = (context: ColorTokenContext, suffix = '') =>
    `${root(context)}/tenants/${context.tenantId}/token-groups${suffix}`;

/** Группы токенов `ds-service` через gateway. */
export const createHttpTokenGroupRepository = (): TokenGroupRepository => ({
    list: (context) =>
        call(() =>
            http.get<TokenGroupDto[]>(`${root(context)}/design-systems/${context.designSystemId}/token-groups`, {
                params: { kind: 'color' },
            }),
        ),
    definitions: async (context) => {
        const tokens = await call(() =>
            http.get<Array<Partial<PlacedDefinition> & Pick<PlacedDefinition, 'id' | 'name' | 'type'>>>(
                `${root(context)}/design-systems/${context.designSystemId}/tokens`,
            ),
        );
        return tokens.map((token) => ({
            id: token.id,
            name: token.name,
            type: token.type,
            groupId: token.groupId ?? null,
            position: token.position ?? 0,
            publishedIn: token.publishedIn ?? null,
        }));
    },
    create: (context, input, editRevision) => call(() => http.post(groupsPath(context), { ...input, editRevision })),
    update: (context, groupId, input, editRevision) =>
        call(() => http.patch(groupsPath(context, `/${encodeURIComponent(groupId)}`), { ...input, editRevision })),
    remove: (context, groupId, editRevision) =>
        call(() => http.delete(groupsPath(context, `/${encodeURIComponent(groupId)}`), { data: { editRevision } })),
});
