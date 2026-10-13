package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.invalidTokenValue
import com.dsbuilder.ds.themes.application.colortokens.valueRule
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Атомарно сохраняет полный набор platform-specific значений темы. */
class SaveTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
) {
    /** Выполняет сохранение для trusted project. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: SaveTenantTokenValues,
    ): DsResult<TenantTokenValuesSaveOutcome.Saved> = when (
        val allowed = policy.require(
            context,
            ProjectScope.TENANTS_WRITE,
        )
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> if (command.values.duplicateKey()) {
            DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        } else {
            transactions.required {
                when (val outcome = repository.saveTokenValues(context.projectId, id, command)) {
                    // Тема уже заблокирована сохранением; отказ проверки откатывает транзакцию целиком.
                    is TenantTokenValuesSaveOutcome.Saved -> colorViolation(context, id, command.values)
                        ?.let { DsResult.Failure(it) }
                        ?: DsResult.Success(outcome)
                    is TenantTokenValuesSaveOutcome.RevisionConflict -> DsResult.Failure(
                        DsFailure.Conflict("TENANT_EDIT_CONFLICT", editRevision = outcome.editRevision),
                    )
                    TenantTokenValuesSaveOutcome.NotFound -> DsResult.Failure(DsFailure.NotFound)
                    TenantTokenValuesSaveOutcome.ForeignToken -> DsResult.Failure(
                        DsFailure.InvalidRequest("invalid_tenant_token"),
                    )
                }
            }
        }
    }

    /** Первое недопустимое значение цветового или градиентного токена или `null`. */
    private suspend fun colorViolation(
        context: DsRequestContext,
        tenantId: UUID,
        values: List<TenantTokenValueInput>,
    ): DsFailure? {
        val types = tokens.tokenTypes(values.map { it.tokenId }.distinct())
            .filterValues { it in ColorTokenFamily.TYPES }
        val checked = values.filter { it.tokenId in types }
        if (checked.isEmpty()) return null
        val rule = palette.valueRule(tenantId)
        return checked.firstNotNullOfOrNull { value ->
            rule.validate(types.getValue(value.tokenId), value.platform, value.paletteId != null, value.value)
                ?.let { reason ->
                    val mode = value.mode?.wireValue.orEmpty()
                    invalidTokenValue("${value.tokenId}:${value.platform.wireValue}:$mode", reason)
                }
        }
    }
}

private fun List<TenantTokenValueInput>.duplicateKey(): Boolean =
    map { "${it.tokenId}:${it.platform.wireValue}:${it.mode?.wireValue}" }.let { it.size != it.toSet().size }
