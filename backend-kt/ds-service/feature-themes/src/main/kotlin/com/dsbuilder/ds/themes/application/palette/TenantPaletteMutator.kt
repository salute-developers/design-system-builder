package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.palette.PaletteOperationResult
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import java.util.UUID

/**
 * Общий порядок операции изменения палитры: право `tenants:write`, блокировка темы и сверка ревизии, чистая
 * операция над состоянием, запись состояния и побочное действие в одной транзакции.
 */
class TenantPaletteMutator(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantPaletteRepository,
) {
    /**
     * Выполняет [operation] над палитрой темы. [effect] получает палитру до операции и выполняется после записи в
     * той же транзакции; [view] строит значение ответа по палитре после операции.
     */
    suspend fun <T, R> mutate(
        context: DsRequestContext,
        tenantId: UUID,
        editRevision: Int,
        view: (T, ThemePalette) -> R,
        effect: suspend (T, ThemePalette) -> Unit = { _, _ -> },
        operation: (TenantPaletteState, ThemePalette) -> PaletteOperationResult<T>,
    ): DsResult<TenantPaletteMutation<R>> = when (val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required {
            when (val lock = repository.lock(context.projectId, tenantId, editRevision)) {
                TenantPaletteLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
                is TenantPaletteLock.RevisionConflict ->
                    DsResult.Failure(DsFailure.Conflict(EDIT_CONFLICT, editRevision = lock.editRevision))
                TenantPaletteLock.Locked -> locked(context, tenantId, operation) { value, before, after ->
                    effect(value, before)
                    view(value, after)
                }
            }
        }
    }

    /** Выполняет [operation] без записи: права и ревизия те же, что у [mutate], данные и ревизия не меняются. */
    suspend fun <T> preview(
        context: DsRequestContext,
        tenantId: UUID,
        editRevision: Int,
        operation: (TenantPaletteState, ThemePalette) -> PaletteOperationResult<T>,
    ): DsResult<T> = when (val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)) {
        is DsResult.Failure -> allowed
        // Изменяющая транзакция: снимок берёт тему FOR SHARE и может создать палитру теме без неё; данные операции
        // не записываются.
        is DsResult.Success -> transactions.required {
            val snapshot = repository.initializedSnapshot(context.projectId, tenantId)
            when {
                snapshot == null || !snapshot.owned -> DsResult.Failure(DsFailure.NotFound)
                snapshot.state.editRevision != editRevision -> DsResult.Failure(
                    DsFailure.Conflict(EDIT_CONFLICT, editRevision = snapshot.state.editRevision),
                )
                else -> when (val result = operation(snapshot.state, palette(tenantId, snapshot))) {
                    is PaletteOperationResult.Rejected -> DsResult.Failure(result.error.toFailure())
                    is PaletteOperationResult.Applied -> DsResult.Success(result.value)
                }
            }
        }
    }

    private suspend fun <T, R> locked(
        context: DsRequestContext,
        tenantId: UUID,
        operation: (TenantPaletteState, ThemePalette) -> PaletteOperationResult<T>,
        complete: suspend (T, ThemePalette, ThemePalette) -> R,
    ): DsResult<TenantPaletteMutation<R>> {
        val snapshot = repository.initializedSnapshot(context.projectId, tenantId)
            ?: return DsResult.Failure(DsFailure.NotFound)
        val palette = palette(tenantId, snapshot)
        return when (val result = operation(snapshot.state, palette)) {
            is PaletteOperationResult.Rejected -> DsResult.Failure(result.error.toFailure())
            is PaletteOperationResult.Applied -> {
                repository.save(tenantId, result.state)
                val after = palette(tenantId, snapshot.copy(state = result.state))
                DsResult.Success(
                    TenantPaletteMutation(result.state.editRevision, complete(result.value, palette, after)),
                )
            }
        }
    }

    private fun palette(tenantId: UUID, snapshot: TenantPaletteSnapshot): ThemePalette =
        ThemePaletteBuilder.build(tenantId.toString(), true, snapshot.state, snapshot.tokens, snapshot.values)

    private companion object {
        const val EDIT_CONFLICT = "TENANT_EDIT_CONFLICT"
    }
}
