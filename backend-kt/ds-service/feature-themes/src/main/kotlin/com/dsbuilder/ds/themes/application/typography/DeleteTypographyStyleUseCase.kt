package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import java.util.UUID

/**
 * Логически удаляет стиль типографии — девять токенов со значениями во всех темах — одной транзакцией. Ссылки
 * компонентов на стиль, в том числе текстовые, становятся пустыми в активном черновике.
 */
class DeleteTypographyStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
) {
    /** Удаление стиля токена [tokenId] в дизайн-системе темы [tenantId]. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID, tokenId: UUID): DsResult<TypographyStyleTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> delete(lock.designSystemId, tenantId, tokenId)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    private suspend fun delete(designSystemId: UUID, tenantId: UUID, tokenId: UUID): DsResult<TypographyStyleTokens> {
        val style = when (val found = repository.styleOf(designSystemId, tokenId)) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        val tokens = repository.styles(designSystemId, tenantId, style)
        val references = usage.anchoredReferences(designSystemId, style, tokens)
        repository.deleteStyle(designSystemId, tokens.mapTo(hashSetOf()) { it.id }, references)
        return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
    }
}
