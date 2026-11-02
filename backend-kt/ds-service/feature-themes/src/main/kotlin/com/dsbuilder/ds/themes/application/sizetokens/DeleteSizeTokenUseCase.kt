package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import java.util.UUID

/**
 * Логически удаляет из активного черновика радиус, отступ или тень со значениями во всех темах: надгробия
 * `deleted = true`, ссылки компонентов сбрасывает общий механизм очистки ссылок на токен. Опубликованные версии сохраняют данные, отмена — через журнал изменений.
 */
class DeleteSizeTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
) {
    /** Удаление токена [tokenId] из дизайн-системы темы [tenantId]; результат — идентификаторы удалённых токенов. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID, tokenId: UUID): DsResult<List<UUID>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required(context) {
            tokens.lock(context.projectId, tenantId)
                ?.let { designSystemId -> delete(designSystemId, tenantId, tokenId) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }

    private suspend fun delete(designSystemId: UUID, tenantId: UUID, tokenId: UUID): DsResult<List<UUID>> {
        val token = tokens.token(designSystemId, tenantId, tokenId) ?: return DsResult.Failure(DsFailure.NotFound)
        if (token.kind == null) return DsResult.Failure(outsideSection(tokenId))
        // Тень — отдельный токен, как радиус и отступ: удаляется только она, без других вариантов того же размера.
        val ids = listOf(token.id)
        tokens.delete(designSystemId, ids)
        return DsResult.Success(ids)
    }
}
