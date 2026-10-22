package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.hasSystemGroups
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.util.UUID

/** Reads token values only for an accessible theme, with colors resolved by the theme palette. */
class GetTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val paletteRepository: TenantPaletteRepository,
) {
    /**
     * Читает значения токенов темы на границе выбранной версии: ссылки цветовых значений, в том числе в стопах
     * градиента и в слоях iOS и Android, заменяются HEX по палитре темы и группе токена. У ссылки на всё значение
     * `paletteId` убирается, а исходная ссылка возвращается в `paletteRef`. Сплошные значения iOS и Android
     * градиентного семейства отдаются слоем `color`. Если отданное значение отличается от хранимого, хранимое
     * возвращается в `sourceValue`. Значение со ссылкой, которую палитра темы не раскрывает, остаётся как есть.
     * Ревью PR #101: раскрытие по общей палитре давало неверные цвета, поэтому другого режима нет.
     */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        types: Set<ThemeTokenType> = emptySet(),
    ): DsResult<List<TenantTokenValue>> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                val needsPalette = types.isEmpty() || ThemeTokenType.COLOR in types || ThemeTokenType.GRADIENT in types
                val snapshot = if (needsPalette) {
                    paletteRepository.snapshot(context.projectId, id)?.takeIf { it.hasSystemGroups() }
                } else {
                    null
                }
                values(context, id, types) { values -> TokenValuePublisher(id, snapshot).publish(values) }
            }
        }

    private suspend fun values(
        context: DsRequestContext,
        id: UUID,
        types: Set<ThemeTokenType>,
        transform: (List<TenantTokenValue>) -> List<TenantTokenValue>,
    ): DsResult<List<TenantTokenValue>> =
        repository.tokenValues(context.projectId, id, types)?.let {
            DsResult.Success(transform(it))
        } ?: if (context.principal.systemAdmin) {
            DsResult.Success(emptyList())
        } else {
            DsResult.Failure(DsFailure.NotFound)
        }
}
