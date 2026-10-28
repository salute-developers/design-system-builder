package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import java.util.UUID

/** Атомарно сохраняет полный набор platform-specific значений темы. */
class SaveTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    tokens: ColorTokenRepository,
    palette: TenantPaletteRepository,
) {
    private val checks = TenantTokenValueChecks(tokens, palette)

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
        is DsResult.Success -> if (command.values.hasDuplicateKey()) {
            DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        } else {
            transactions.required(context) {
                val stored = command.copy(values = checks.storedForm(command.values))
                when (val outcome = repository.saveTokenValues(context.projectId, id, stored)) {
                    // Тема уже заблокирована сохранением; отказ проверки откатывает транзакцию целиком.
                    is TenantTokenValuesSaveOutcome.Saved -> checks.colorViolation(id, command.values)
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
}
