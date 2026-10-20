package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueCheck
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueParser
import java.util.UUID

/**
 * Заменяет значение радиуса, отступа или варианта тени только в текущей теме: веб и свои значения платформ
 * с `overridden: true`, остальные платформы строятся из веба с `overridden: false`.
 */
class UpdateSizeTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
) {
    /** Замена значения токена [tokenId] в теме [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: UpdateSizeTokenValue,
    ): DsResult<SizeTokenMutation<UpdatedSizeToken>> {
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required {
            when (val lock = tokens.lock(context.projectId, tenantId, command.editRevision, allThemes = false)) {
                is SizeTokenLock.Locked -> update(tenantId, tokenId, lock, command)
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun update(
        tenantId: UUID,
        tokenId: UUID,
        lock: SizeTokenLock.Locked,
        command: UpdateSizeTokenValue,
    ): DsResult<SizeTokenMutation<UpdatedSizeToken>> {
        val token = tokens.token(lock.designSystemId, tenantId, tokenId) ?: return DsResult.Failure(DsFailure.NotFound)
        val kind = token.kind ?: return DsResult.Failure(outsideSection(tokenId))
        if (kind == SizeTokenKind.RADIUS && SizeTokenNaming.isFullRounding(token.name)) {
            return DsResult.Failure(invalidSizeToken("Значение полного скругления ${token.name} не правится"))
        }
        val value = when (val check = SizeValueParser.parse(kind, command.value)) {
            is SizeValueCheck.Invalid -> return DsResult.Failure(check.violation.toFailure())
            is SizeValueCheck.Valid -> check.value
        }
        val written = SizePlatformValues.write(kind, value)
        tokens.replaceValues(listOf(tenantId), tokenId, written)
        val revision = tokens.bumpRevisions(listOf(tenantId)).getValue(tenantId)
        val stored = token.copy(values = written.associate { it.platform to SizeStoredValue(it.value, it.overridden) })
        val view = usage.views(lock.designSystemId, listOf(stored)).single()
        return DsResult.Success(SizeTokenMutation(revision, UpdatedSizeToken(view, written)))
    }
}
