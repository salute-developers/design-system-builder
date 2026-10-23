package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import java.util.UUID

/**
 * Логически удаляет из активного черновика радиус или отступ, а для тени — размер целиком (четыре варианта), со
 * значениями во всех темах: надгробия `deleted = true`, ссылки компонентов сбрасывает общий механизм очистки ссылок
 * на токен. Опубликованные версии сохраняют данные, отмена — через журнал изменений.
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
        val kind = token.kind ?: return DsResult.Failure(outsideSection(tokenId))
        val ids = if (kind == SizeTokenKind.SHADOW) {
            val names = SizeTokenNaming.shadowSizeNames(SizeTokenNaming.shadowSize(token.name))
            tokens.tokens(designSystemId, tenantId)
                .filter { it.kind == SizeTokenKind.SHADOW && it.name in names }
                .sortedBy { names.indexOf(it.name) }
                .map(StoredSizeToken::id)
        } else {
            listOf(token.id)
        }
        tokens.delete(designSystemId, ids)
        return DsResult.Success(ids)
    }
}
