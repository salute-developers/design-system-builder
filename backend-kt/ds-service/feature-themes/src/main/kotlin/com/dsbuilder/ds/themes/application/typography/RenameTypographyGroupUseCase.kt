package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import java.util.UUID

/**
 * Переименовывает свою группу типографии в именах токенов всех её стилей одной транзакцией; размеры и
 * идентификаторы токенов сохраняются. Системные группы не переименовываются. Текстовые ссылки компонентов на стили
 * группы привязываются по `token_id`, как при переименовании стиля.
 */
class RenameTypographyGroupUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Переименование группы [group] дизайн-системы темы [tenantId] в [name]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        group: String,
        name: String,
    ): DsResult<TypographyStyleTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        val invalid = when {
            TypographyStyleNaming.systemGroup(group) -> systemGroupFailure(group)
            !TypographyStyleNaming.validGroup(name) -> invalidGroupName()
            else -> null
        }
        if (invalid != null) return DsResult.Failure(invalid)
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> rename(lock.designSystemId, tenantId, group, name)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun rename(
        designSystemId: UUID,
        tenantId: UUID,
        group: String,
        name: String,
    ): DsResult<TypographyStyleTokens> {
        val all = repository.styles(designSystemId, tenantId)
        val tokens = all.filter { it.name.style.group == group }
        if (tokens.isEmpty()) return DsResult.Failure(DsFailure.NotFound)
        if (name == group) return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
        if (TypographyStyleNaming.systemGroup(name) || all.any { it.name.style.group == name }) {
            return DsResult.Failure(groupTaken(name))
        }
        val current = tokens.mapTo(hashSetOf()) { it.name.toString() }
        val others = all.map { it.name.style }.filter { it.group != group }.distinct()
        tokens.map { it.name.style }.distinct().sorted().forEach { style ->
            repository.claimStyle(uniqueKeys, designSystemId, style.copy(group = name), others, except = current)
                ?.let { return DsResult.Failure(it) }
        }
        val references = usage.groupReferences(designSystemId, tokens)
        val names = tokens.associate { it.id to it.name.copy(style = it.name.style.copy(group = name)) }
        repository.renameStyle(designSystemId, names, references)
        return DsResult.Success(TypographyStyleTokens(tokens.map { it.id }))
    }
}
