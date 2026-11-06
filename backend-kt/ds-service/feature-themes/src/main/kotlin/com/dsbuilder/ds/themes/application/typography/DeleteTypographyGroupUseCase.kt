package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import java.util.UUID

/**
 * Логически удаляет свою группу типографии — токены всех её стилей со значениями во всех темах — одной транзакцией.
 * Системные группы не удаляются. Ссылки компонентов на стили группы, в том числе текстовые, становятся пустыми.
 */
class DeleteTypographyGroupUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
) {
    /** Удаление группы [group] дизайн-системы темы [tenantId]. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID, group: String): DsResult<TypographyStyleTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        if (TypographyStyleNaming.systemGroup(group)) return DsResult.Failure(systemGroupFailure(group))
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> delete(lock.designSystemId, tenantId, group)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    private suspend fun delete(designSystemId: UUID, tenantId: UUID, group: String): DsResult<TypographyStyleTokens> {
        val tokens = repository.styles(designSystemId, tenantId).filter { it.name.style.group == group }
        if (tokens.isEmpty()) return DsResult.Failure(DsFailure.NotFound)
        val references = usage.groupReferences(designSystemId, tokens)
        repository.deleteStyle(designSystemId, tokens.mapTo(hashSetOf()) { it.id }, references)
        return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
    }
}
