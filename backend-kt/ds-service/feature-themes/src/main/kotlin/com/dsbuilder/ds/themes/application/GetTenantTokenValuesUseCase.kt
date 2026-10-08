package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.application.palette.initializedSnapshot
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import java.util.UUID

/** Reads token values only for an accessible theme, optionally with colors resolved by the theme palette. */
class GetTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val paletteRepository: TenantPaletteRepository,
) {
    /**
     * Читает значения токенов темы; с [resolvePalette] ссылки цветовых значений заменяются HEX по палитре темы и
     * группе токена без `paletteId`, а исходная ссылка возвращается в `paletteRef`.
     */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        resolvePalette: Boolean = false,
    ): DsResult<List<TenantTokenValue>> = when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> if (resolvePalette) {
            // Снимок палитры берёт тему FOR SHARE до чтения значений: оба чтения видят одно состояние, и сопоставление
            // значений по `id` не теряется из-за параллельного `PUT token-values`. Транзакция изменяющая — теме без
            // палитры копия шаблона создаётся здесь же.
            transactions.required {
                val snapshot = paletteRepository.initializedSnapshot(context.projectId, id)
                values(context, id) { values -> snapshot?.let { resolved(id, it, values) } ?: values }
            }
        } else {
            transactions.readOnly { values(context, id) { it } }
        }
    }

    private suspend fun values(
        context: DsRequestContext,
        id: UUID,
        transform: (List<TenantTokenValue>) -> List<TenantTokenValue>,
    ): DsResult<List<TenantTokenValue>> =
        repository.tokenValues(context.projectId, id)?.let {
            DsResult.Success(transform(it))
        } ?: if (context.principal.systemAdmin) {
            DsResult.Success(emptyList())
        } else {
            DsResult.Failure(DsFailure.NotFound)
        }

    private fun resolved(
        id: UUID,
        snapshot: TenantPaletteSnapshot,
        values: List<TenantTokenValue>,
    ): List<TenantTokenValue> {
        val palette = ThemePaletteBuilder.build(id.toString(), false, snapshot.state, snapshot.tokens, snapshot.values)
        val tokenNames = snapshot.tokens.associate { it.id to it.name }
        val colorValues = snapshot.values.filter { it.valueId != null }.associateBy { it.valueId }
        return values.map { value ->
            val colorValue = colorValues[value.id.toString()]
            val reference = colorValue?.reference
            val tokenName = colorValue?.let { tokenNames[it.tokenId] }
            val hex = tokenName?.let { name -> reference?.let { ThemePaletteResolver.resolve(palette, name, it) } }
            // Вычисленный HEX самодостаточен: `paletteId` убирается, чтобы потребитель не разрешил его ещё раз.
            if (hex == null) {
                value
            } else {
                value.copy(paletteId = null, valueJson = "[\"$hex\"]", paletteRef = reference?.format())
            }
        }
    }
}
