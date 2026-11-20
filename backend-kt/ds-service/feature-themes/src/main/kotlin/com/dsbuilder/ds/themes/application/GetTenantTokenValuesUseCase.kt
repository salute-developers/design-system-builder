package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantValuePaletteSnapshot
import com.dsbuilder.ds.themes.application.palette.hasSystemGroups
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import com.dsbuilder.ds.themes.domain.palette.ShadowLayerColors
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
     * возвращается в `sourceValue`. Ссылки цветов слоёв тени заменяются `#RRGGBBAA` на своём месте. Значение со
     * ссылкой, которую палитра темы не раскрывает, остаётся как есть.
     * Ревью PR #101: раскрытие по общей палитре давало неверные цвета, поэтому другого режима нет.
     * Непустой [platforms] оставляет значения только этих платформ до публикации: ответ и работа публикатора меньше.
     */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        types: Set<ThemeTokenType> = emptySet(),
        platforms: Set<ThemeTokenPlatform> = emptySet(),
        tokenIds: Set<UUID> = emptySet(),
    ): DsResult<List<TenantTokenValue>> {
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> return allowed
            is DsResult.Success -> Unit
        }
        val prepared = transactions.readOnly(context) {
            val stored = if (tokenIds.isEmpty()) {
                repository.tokenValues(context.projectId, id, types)
            } else {
                repository.tokenValuesForTokens(context.projectId, id, types, tokenIds)
            }
            if (stored == null && !context.principal.globalAdmin) {
                DsResult.Failure(DsFailure.NotFound)
            } else {
                val values = stored.orEmpty()
                val wire = platforms.mapTo(hashSetOf(), ThemeTokenPlatform::wireValue)
                val selected = if (wire.isEmpty()) values else values.filter { it.platform in wire }
                val snapshot = if (selected.any(::requiresPalette)) {
                    paletteRepository.valueSnapshot(context.projectId, id, values)
                        ?.takeIf { it.hasSystemGroups() }
                } else {
                    null
                }
                DsResult.Success(PreparedValues(selected, snapshot))
            }
        }
        // Все данные снимка материализованы в одной транзакции; чистое раскрытие уже не удерживает соединение.
        return when (prepared) {
            is DsResult.Failure -> prepared
            is DsResult.Success -> DsResult.Success(
                TokenValuePublisher(prepared.value.snapshot).publish(prepared.value.values),
                mutationMetadata = prepared.mutationMetadata,
                readContext = prepared.readContext,
                readPage = prepared.readPage,
            )
        }
    }

    private data class PreparedValues(
        val values: List<TenantTokenValue>,
        val snapshot: TenantValuePaletteSnapshot?,
    )

    private fun requiresPalette(value: TenantTokenValue): Boolean = when (value.tokenType) {
        ThemeTokenType.COLOR, ThemeTokenType.GRADIENT ->
            value.paletteId != null || ValuePaletteReferences.find(value.value).isNotEmpty()
        ThemeTokenType.SHADOW -> ShadowLayerColors.references(value.value).isNotEmpty()
        else -> false
    }
}
