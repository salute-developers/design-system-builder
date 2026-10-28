package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.invalidTokenValue
import com.dsbuilder.ds.themes.application.colortokens.valueRule
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import java.util.UUID

/** Хранимая форма и проверка значений темы, общие для пакетной записи и создания темы со значениями. */
internal class TenantTokenValueChecks(
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
) {
    /**
     * Сплошные значения iOS и Android цветовых и градиентных токенов хранятся строкой: слой `color` из запроса
     * записывается как `[<цвет>]`. Тип токенов запись не меняет.
     */
    suspend fun storedForm(values: List<TenantTokenValueInput>): List<TenantTokenValueInput> {
        if (values.isEmpty()) return values
        val colorTokens = colorTypes(values).keys
        if (colorTokens.isEmpty()) return values
        return values.map { value ->
            if (value.tokenId in colorTokens) {
                value.copy(value = ColorValueShape.storedForm(value.platform, value.value))
            } else {
                value
            }
        }
    }

    /** Первое недопустимое значение цветового или градиентного токена темы [tenantId] или `null`. */
    suspend fun colorViolation(tenantId: UUID, values: List<TenantTokenValueInput>): DsFailure? {
        if (values.isEmpty()) return null
        val types = colorTypes(values)
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

    private suspend fun colorTypes(values: List<TenantTokenValueInput>) =
        tokens.tokenTypes(values.map { it.tokenId }.distinct()).filterValues { it in ColorTokenFamily.TYPES }
}

/** В наборе есть две записи одной комбинации `tokenId + platform + mode`. */
internal fun List<TenantTokenValueInput>.hasDuplicateKey(): Boolean =
    map { "${it.tokenId}:${it.platform.wireValue}:${it.mode?.wireValue}" }.let { it.size != it.toSet().size }
