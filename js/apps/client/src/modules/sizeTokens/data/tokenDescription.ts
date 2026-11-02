import { apiRoot } from '../../../api/editorHttp';
import { http } from '../../../api/http';
import { subjectMutation } from '../../../api/subjectMutation';
import { SizeTokenOperationError, type SizeTokenContext } from '../application/sizeTokenRepository';

/**
 * Описание токена размеров: у раздела нет своей операции, описание хранит определение токена
 * (`PATCH /api/projects/{projectId}/ds/tokens/{id}`, поле `description`). Пустая строка убирает описание.
 */
export const saveSizeTokenDescription = async (context: SizeTokenContext, tokenId: string, description: string) => {
    try {
        await subjectMutation(context, () =>
            http.patch(
                `${apiRoot(context.projectId)}/tokens/${encodeURIComponent(tokenId)}`,
                { description: description || null },
                { headers: { 'Idempotency-Key': crypto.randomUUID() } },
            ),
        );
    } catch {
        // Поле описания показывает текст ошибки как есть: ответ сервера и сообщения axios — не для пользователя.
        throw new SizeTokenOperationError('failed', 'Не удалось сохранить описание токена.');
    }
};
