package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueCheck
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueParser
import java.util.UUID

/**
 * Заменяет значение радиуса, отступа или варианта тени только в текущей теме активного черновика: веб и свои
 * значения платформ с `overridden: true`, остальные платформы строятся из веба с `overridden: false`. Записываются
 * предметные редакции только изменившихся значений; конкурентная правка одного значения — по правилу «последняя
 * запись побеждает» с предупреждением в метаданных изменения.
 */
class UpdateSizeTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
    private val palette: TenantPaletteRepository,
) {
    /** Замена значения токена [tokenId] в теме [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: UpdateSizeTokenValue,
    ): DsResult<UpdatedSizeToken> {
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        if (command.baseRevisions.values.any { it < 0 }) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_base_revision"))
        }
        return transactions.required(context) {
            tokens.lock(context.projectId, tenantId)
                ?.let { designSystemId -> update(context, designSystemId, tenantId, tokenId, command) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }

    @Suppress("ReturnCount")
    private suspend fun update(
        context: DsRequestContext,
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        command: UpdateSizeTokenValue,
    ): DsResult<UpdatedSizeToken> {
        val token = tokens.token(designSystemId, tenantId, tokenId) ?: return DsResult.Failure(DsFailure.NotFound)
        val kind = token.kind ?: return DsResult.Failure(outsideSection(tokenId))
        if (kind == SizeTokenKind.RADIUS && SizeTokenNaming.isFullRounding(token.name)) {
            return DsResult.Failure(invalidSizeToken("Значение полного скругления ${token.name} не правится"))
        }
        val value = when (val check = SizeValueParser.parse(kind, command.value)) {
            is SizeValueCheck.Invalid -> return DsResult.Failure(check.violation.toFailure())
            is SizeValueCheck.Valid -> check.value
        }
        val colors = ShadowColorPalette(palette)
        colors.missingStep(tenantId, SizeValueParser.colorReferences(value))?.let {
            return DsResult.Failure(missingPaletteStep(it))
        }
        val written = SizePlatformValues.write(kind, value)
        tokens.writeValues(designSystemId, tenantId, tokenId, written, command.baseRevisions)
        val stored = token.copy(values = written.associate { it.platform to SizeStoredValue(it.value, it.overridden) })
        val resolve = colors.resolver(context.projectId, tenantId)
        val view = usage.views(designSystemId, listOf(stored), resolve).single()
        return DsResult.Success(UpdatedSizeToken(view, written))
    }
}
