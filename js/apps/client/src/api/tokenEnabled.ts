import type { EditorContextKey, TokenDefinitionDto } from './editorContracts';
import { recordDraftSave } from './draftAutosaveActivity';
import { apiRoot } from './editorHttp';
import { http } from './http';
import { subjectMutation, subjectMutationHeaders } from './subjectMutation';

/**
 * Включает или отключает определения токена (`PATCH /tokens/{id}`, поле `enabled`). Признак принадлежит определению,
 * поэтому действует во всех темах. Определения меняются по одному, как описание: повтор после сбоя идемпотентен. Вся
 * пачка — одна операция черновика: раздел [tokenTypes] перечитывается один раз после последнего запроса. Если часть
 * определений уже сохранилась, а следующий запрос упал, раздел тоже перечитывается: экран показывает фактические флаги.
 */
export const saveTokenEnabled = async (
    context: EditorContextKey,
    tokenIds: readonly string[],
    enabled: boolean,
    tokenTypes: TokenDefinitionDto['type'][],
) => {
    let saved = 0;
    try {
        await subjectMutation(
            context,
            async () => {
                for (const tokenId of tokenIds) {
                    await http.patch(
                        `${apiRoot(context.projectId, context.designSystemId)}/tokens/${encodeURIComponent(tokenId)}`,
                        { enabled },
                        { headers: subjectMutationHeaders() },
                    );
                    saved += 1;
                }
            },
            undefined,
            tokenTypes,
        );
    } catch (error) {
        if (saved) recordDraftSave(context, tokenTypes);
        throw error;
    }
};
