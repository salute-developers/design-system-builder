package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView
import java.util.UUID

/**
 * Переименовывает радиус, отступ или тень в активном черновике одной транзакцией. Идентификатор определения
 * сохраняется, поэтому ссылки компонентов по `token_id` остаются верными; текстовые ссылки на прежнее имя
 * привязываются к токену по `token_id`, чтобы идти за новым именем и за откатом переименования в журнале.
 */
class RenameSizeTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
    private val palette: TenantPaletteRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Переименование токена [tokenId] в [name]: у радиуса и отступа — часть после префикса, у тени — имя целиком. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        name: String,
    ): DsResult<SizeTokenView> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required(context) {
            tokens.lock(context.projectId, tenantId)
                ?.let { designSystemId -> rename(context, designSystemId, tenantId, tokenId, name) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }

    @Suppress("ReturnCount")
    private suspend fun rename(
        context: DsRequestContext,
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        name: String,
    ): DsResult<SizeTokenView> {
        val token = tokens.token(designSystemId, tenantId, tokenId) ?: return DsResult.Failure(DsFailure.NotFound)
        val kind = token.kind ?: return DsResult.Failure(outsideSection(tokenId))
        invalidName(kind, name)?.let { return DsResult.Failure(it) }
        if (SizeTokenNaming.isFullRounding(token.name)) {
            return DsResult.Failure(invalidSizeToken("Полное скругление ${token.name} не переименовывается"))
        }
        val full = SizeTokenNaming.fullName(kind, name)
        val resolve = ShadowColorPalette(palette).resolver(context.projectId, tenantId)
        if (full == token.name) return DsResult.Success(usage.views(designSystemId, listOf(token), resolve).single())
        tokens.claimName(uniqueKeys, designSystemId, tenantId, kind, full, except = tokenId)
            ?.let { return DsResult.Failure(it) }
        tokens.rename(designSystemId, tokenId, full, usage.textReferences(designSystemId, tokenId, token.name))
        val renamed = token.copy(name = full)
        return DsResult.Success(usage.views(designSystemId, listOf(renamed), resolve).single())
    }
}
