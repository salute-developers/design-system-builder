package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.application.TokenValueRead
import com.dsbuilder.ds.core.application.TokenValueReadPolicy
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.TokenValuePublisher
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.hasSystemGroups
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.UUID

/**
 * Форма значений общего маршрута `GET /api/ds/token-values` та же, что у `GET /api/ds/tenants/{id}/token-values`:
 * ссылки на палитру раскрываются по палитре темы значения на границе выбранной версии, сплошные значения iOS и
 * Android градиентного семейства отдаются слоем `color`, исходное значение — в `sourceValue`, а при ссылке на всё
 * значение — в `paletteRef` без `sourceValue`. Значения не цветовых токенов не меняются.
 *
 * Снимок палитры берётся с фильтром проекта [publish]: общий маршрут, в том числе для системного администратора,
 * отдаёт только значения дизайн-систем проекта запроса, поэтому тема каждого значения входит в снимок.
 */
class ColorTokenValueReadPolicy(
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
) : TokenValueReadPolicy {
    override suspend fun publish(projectId: ProjectId, values: List<TokenValueRead>): List<TokenValueRead> {
        val types = tokens.tokenTypes(values.mapNotNull { it.tokenId }.distinct())
            .filterValues { it in ColorTokenFamily.TYPES }
        if (types.isEmpty()) return values
        val published = values.filter { it.tokenId in types }.groupBy { it.tenantId }.flatMap { (tenantId, items) ->
            val snapshot = tenantId?.let { palette.snapshot(projectId, it) }?.takeIf { it.hasSystemGroups() }
            val publisher = TokenValuePublisher(tenantId ?: NO_TENANT, snapshot)
            items.zip(publisher.publish(items.map { it.tenantValue(types[it.tokenId]) }))
        }.associate { (read, value) -> read.id to read.published(value) }
        return values.map { published[it.id] ?: it }
    }

    private fun TokenValueRead.tenantValue(type: ThemeTokenType?) = TenantTokenValue(
        id = id,
        tokenId = tokenId,
        tenantId = tenantId,
        paletteId = paletteId,
        platform = platform,
        mode = null,
        valueJson = value?.toString(),
        editRevision = 0,
        createdAt = Instant.EPOCH,
        updatedAt = Instant.EPOCH,
        tokenType = type,
    )

    private fun TokenValueRead.published(value: TenantTokenValue) = copy(
        paletteId = value.paletteId,
        value = value.valueJson?.let(Json::parseToJsonElement),
        paletteRef = value.paletteRef,
        sourceValue = value.sourceValueJson?.let(Json::parseToJsonElement),
    )

    private companion object {
        /** Тема для значения без темы: палитры у него нет, применяется только форма по типу. */
        val NO_TENANT: UUID = UUID(0, 0)
    }
}
