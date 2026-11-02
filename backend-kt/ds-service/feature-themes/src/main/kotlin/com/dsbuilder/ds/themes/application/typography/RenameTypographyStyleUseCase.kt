package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import java.util.UUID

/**
 * Переименовывает размер стиля типографии в именах его девяти токенов одной транзакцией; группа не меняется,
 * идентификаторы токенов сохраняются. Текстовые ссылки компонентов на стиль привязываются по `token_id`, чтобы
 * идти за новым именем и за откатом переименования в журнале.
 */
class RenameTypographyStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Переименование стиля токена [tokenId] в размер [size]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        size: String,
    ): DsResult<TypographyStyleTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> rename(lock.designSystemId, tenantId, tokenId, size)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun rename(
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        size: String,
    ): DsResult<TypographyStyleTokens> {
        val style = when (val found = repository.styleOf(designSystemId, tokenId)) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        invalidStyleName(style.group, size)?.let { return DsResult.Failure(it) }
        val tokens = repository.styles(designSystemId, tenantId, style)
        if (size == style.size) return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
        val target = TypographyStyleKey(style.group, size)
        val current = tokens.mapTo(hashSetOf()) { it.name.toString() }
        repository.claimStyle(uniqueKeys, designSystemId, target, except = current)?.let { return DsResult.Failure(it) }
        val references = usage.anchoredReferences(designSystemId, style, tokens)
        repository.renameStyle(designSystemId, tokens.associate { it.id to it.name.copy(style = target) }, references)
        return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
    }
}
