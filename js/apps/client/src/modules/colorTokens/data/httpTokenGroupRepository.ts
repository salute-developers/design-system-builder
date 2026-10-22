import { http } from '../../../api/http';
import type { ColorTokenContext } from '../application/colorTokenRepository';
import type { PlacedDefinition, TokenGroupRepository } from '../application/tokenGroupRepository';
import type { TokenGroupDto } from '../domain';
import { callOperation as call } from './httpOperation';
import { subjectMutation, subjectMutationHeaders } from '../../../api/subjectMutation';
import { subjectBaseRevision } from '../../../api/subjectRevisions';

const root = ({ projectId }: ColorTokenContext) => `/api/projects/${projectId}/ds`;
const groupsPath = (context: ColorTokenContext, suffix = '') =>
    `${root(context)}/tenants/${context.tenantId}/token-groups${suffix}`;

/** Группы токенов `ds-service` через gateway. */
export const createHttpTokenGroupRepository = (): TokenGroupRepository => ({
    list: (context) =>
        call(() =>
            http.get<TokenGroupDto[]>(`${root(context)}/design-systems/${context.designSystemId}/token-groups`, {
                params: { kind: 'color', versionId: context.versionId },
            }),
        ),
    definitions: async (context) => {
        const tokens = await call(() =>
            http.get<Array<Partial<PlacedDefinition> & Pick<PlacedDefinition, 'id' | 'name' | 'type'>>>(
                `${root(context)}/design-systems/${context.designSystemId}/tokens`,
                { params: context.versionId ? { versionId: context.versionId } : undefined },
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
    create: (context, input, editRevision) =>
        call(() =>
            subjectMutation(context, () =>
                http.post(groupsPath(context), { ...input, editRevision }, { headers: subjectMutationHeaders() }),
            ),
        ),
    update: (context, groupId, input, editRevision) =>
        call(() =>
            subjectMutation(
                context,
                () =>
                    http.patch(
                        groupsPath(context, `/${encodeURIComponent(groupId)}`),
                        { ...input, editRevision },
                        { headers: subjectMutationHeaders(subjectBaseRevision(context, `token-group:${groupId}`)) },
                    ),
                { address: `token-group:${groupId}`, entityType: 'token-group' },
            ),
        ),
    remove: (context, groupId, editRevision) =>
        call(() =>
            subjectMutation(
                context,
                () =>
                    http.delete(groupsPath(context, `/${encodeURIComponent(groupId)}`), {
                        data: { editRevision },
                        headers: subjectMutationHeaders(subjectBaseRevision(context, `token-group:${groupId}`)),
                    }),
                { address: `token-group:${groupId}`, entityType: 'token-group' },
            ),
        ),
});
