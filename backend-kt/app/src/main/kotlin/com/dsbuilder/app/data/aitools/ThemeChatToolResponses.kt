package com.dsbuilder.app.data.aitools

import com.dsbuilder.ds.designsystems.presentation.DesignSystemTokenSummaryResponse
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.application.sizetokens.UpdatedSizeToken
import com.dsbuilder.ds.themes.application.typography.UpdatedTypographyStyle
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupView
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.DerivedRadius
import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.NativePlatform
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowLayer
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleView
import com.dsbuilder.ds.themes.presentation.TenantResponse
import com.dsbuilder.ds.themes.presentation.TenantTokenValueResponse
import com.dsbuilder.ds.themes.presentation.colortokens.ColorTokenValuesResponse
import com.dsbuilder.ds.themes.presentation.palette.PaletteAnchorDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteGroupDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteRampDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteRampRefDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteStepDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteStepValueDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteTemplateRampDto
import com.dsbuilder.ds.themes.presentation.palette.PaletteTokenAssignmentDto
import com.dsbuilder.ds.themes.presentation.palette.ThemePaletteResponse
import com.dsbuilder.ds.themes.presentation.sizetokens.AdjustedUsageDto
import com.dsbuilder.ds.themes.presentation.sizetokens.ComponentUsageDto
import com.dsbuilder.ds.themes.presentation.sizetokens.DerivedRadiusDto
import com.dsbuilder.ds.themes.presentation.sizetokens.RadiusTokenDto
import com.dsbuilder.ds.themes.presentation.sizetokens.ShadowLayerDto
import com.dsbuilder.ds.themes.presentation.sizetokens.ShadowLayersDto
import com.dsbuilder.ds.themes.presentation.sizetokens.ShadowTokenDto
import com.dsbuilder.ds.themes.presentation.sizetokens.SpacingTokenDto
import com.dsbuilder.ds.themes.presentation.sizetokens.UpdateSizeTokenValueResponse
import com.dsbuilder.ds.themes.presentation.sizetokens.WrittenSizeValueDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyComponentDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyOverrideDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyPlatformValueDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyStyleDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyTokenValuesDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyValueRevisionDto
import com.dsbuilder.ds.themes.presentation.typography.TypographyVariantDto
import com.dsbuilder.ds.themes.presentation.typography.UpdatedTypographyStyleResponse
import com.dsbuilder.ds.tokens.presentation.TokenResponse
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/*
 * Ответы инструментов тем в форме ответов маршрутов ds-service. Публичные DTO берутся из presentation ds-service,
 * закрытые там функции перевода (`toResponse`, `toJson`) повторены здесь без новых полей. Кодирование — `Json` по
 * умолчанию, как у сохранённого ответа повтора в `repeatableThemeMutation`.
 */

/** Темы, как `GET /tenants`. */
internal val TENANTS = ListSerializer(TenantResponse.serializer())

/** Итог `PUT /tenants/{tenantId}/color-tokens/{tokenId}/values`. */
internal fun encodeColorTokenValues(value: ColorTokenMutation<ThemeTokenType>): JsonElement =
    Json.encodeToJsonElement(ColorTokenValuesResponse.serializer(), ColorTokenValuesResponse.from(value))

/** Палитра темы, как `GET /tenants/{tenantId}/palette` (`ThemePalette.toResponse()` ds-service). */
internal fun encodeThemePalette(value: ThemePalette): JsonElement = Json.encodeToJsonElement(
    ThemePaletteResponse.serializer(),
    ThemePaletteResponse(
        tenantId = value.tenantId,
        editRevision = value.editRevision,
        canEdit = value.canEdit,
        offBrand = value.offBrand,
        groups = value.groups.map { it.toDto() },
        tokens = value.tokens.map {
            PaletteTokenAssignmentDto(it.tokenId, it.tokenName, it.groupId, if (it.explicit) "explicit" else "default")
        },
        template = value.template.map { template ->
            PaletteTemplateRampDto(
                template.ramp.type.wireValue,
                template.ramp.shade,
                template.steps.map { (step, color) -> PaletteStepValueDto(step, color) },
            )
        },
        subjectRevisions = value.subjectRevisions,
    ),
)

private fun PaletteGroupView.toDto() =
    PaletteGroupDto(id, kind.wireValue, systemKey?.wireValue, label, ramps.map { it.toDto() })

private fun PaletteRampView.toDto() = PaletteRampDto(
    slot = slot.toDto(),
    source = source.toDto(),
    displayName = displayName,
    origin = origin.wireValue,
    anchor = anchor?.let { PaletteAnchorDto(it.step, it.value) },
    added = added,
    modified = modified,
    linkedCount = linkedCount,
    steps = steps.map { PaletteStepDto(it.step, it.value, it.templateValue, it.overridden, it.linkedCount) },
)

private fun PaletteRampRef.toDto() = PaletteRampRefDto(type.wireValue, shade)

/** Итог `PUT /tenants/{tenantId}/size-tokens/{tokenId}/value`. */
internal fun encodeUpdatedSizeToken(value: UpdatedSizeToken): JsonElement = Json.encodeToJsonElement(
    UpdateSizeTokenValueResponse.serializer(),
    UpdateSizeTokenValueResponse(
        kind = value.token.kind.wireValue,
        token = value.token.toJson(),
        values = value.values.map { WrittenSizeValueDto(it.platform.wireValue, it.value, it.overridden) },
    ),
)

private fun SizeTokenView.toJson(): JsonElement = when (this) {
    is ShadowTokenView -> Json.encodeToJsonElement(ShadowTokenDto.serializer(), toDto())
    is DimensionTokenView -> if (kind == SizeTokenKind.RADIUS) {
        Json.encodeToJsonElement(RadiusTokenDto.serializer(), toRadius())
    } else {
        Json.encodeToJsonElement(SpacingTokenDto.serializer(), toSpacing())
    }
}

private fun DimensionTokenView.toRadius() = RadiusTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    valuePx = valuePx,
    fullRounding = fullRounding,
    platforms = platforms.wire(),
    native = native.wire(),
    platformsDiffer = platformsDiffer,
    components = components.map { it.toDto() },
    derived = derived.map { it.toDto() },
)

private fun DimensionTokenView.toSpacing() = SpacingTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    valuePx = valuePx,
    platforms = platforms.wire(),
    native = native.wire(),
    platformsDiffer = platformsDiffer,
    components = components.map { it.toDto() },
)

private fun ShadowTokenView.toDto() = ShadowTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    layers = layers.map { it.toDto() },
    fallbackElevation = fallbackElevation,
    platforms = platforms.wire().mapValues { (_, layers) -> ShadowLayersDto(layers.map { it.toDto() }) },
    native = native.wire().mapValues { (_, layers) ->
        layers?.let { ShadowLayersDto(it.map { layer -> layer.toDto() }) }
    },
    platformsDiffer = platformsDiffer,
    components = components.map { it.toDto() },
)

private fun ShadowLayer.toDto() = ShadowLayerDto(offsetX, offsetY, blur, spread, color, colorRef)

private fun ComponentUsage.toDto() = ComponentUsageDto(name, count)

private fun DerivedRadius.toDto() = DerivedRadiusDto(
    offsetPx = offsetPx,
    valuePx = valuePx,
    usages = usages.map { AdjustedUsageDto(it.component, it.platform, it.parameter) },
)

private fun <T> Map<NativePlatform, T>.wire(): Map<String, T> =
    NativePlatform.entries.filter { it in this }.associate { it.wireValue to getValue(it) }

/** Итог `PATCH /tenants/{tenantId}/typography-styles/{tokenId}`. */
internal fun encodeUpdatedTypographyStyle(value: UpdatedTypographyStyle): JsonElement = Json.encodeToJsonElement(
    UpdatedTypographyStyleResponse.serializer(),
    UpdatedTypographyStyleResponse(
        style = value.style.toDto(),
        tokens = value.tokens.map { token ->
            TypographyTokenValuesDto(
                tokenId = token.tokenId.toString(),
                name = token.name,
                values = token.values.entries.map { (platform, json) ->
                    TypographyPlatformValueDto(platform.wireValue, json)
                },
            )
        },
    ),
)

private fun TypographyStyleView.toDto() = TypographyStyleDto(
    screen = screen.wireValue,
    group = key.group,
    size = key.size,
    sizePx = sizePx,
    lineHeightPx = lineHeightPx,
    letterSpacingEm = letterSpacingEm,
    fontFamily = fontFamily,
    variants = variants.entries.associate { (variant, view) ->
        variant.wireValue to TypographyVariantDto(
            view.tokenId.toString(),
            view.weight,
            view.valueRevisions.map {
                TypographyValueRevisionDto(it.platform.wireValue, it.valueId.toString(), it.revision)
            },
        )
    },
    components = components.map { TypographyComponentDto(it.name, it.count) },
    overrides = overrides.entries.associate { (platform, override) ->
        platform.wireValue to TypographyOverrideDto(
            sizePx = override.sizePx,
            lineHeightPx = override.lineHeightPx,
            letterSpacingEm = override.letterSpacingEm,
            weights = override.weights.mapKeys { (variant, _) -> variant.wireValue },
        )
    },
)

/**
 * Данные правки токена в теме, как их собирает `token_edit_data_get` MCP из четырёх чтений: определение
 * `GET /tokens/{id}`, `editRevision` из `GET /tenants/{id}`, члены цветового семейства из `GET /tokens` DS (или
 * само определение вне семейства) и значения членов из `GET /tenants/{id}/token-values`.
 */
internal fun encodeTokenEditData(
    definition: TokenResponse,
    tenant: TenantResponse,
    tokens: List<DesignSystemTokenSummaryResponse>,
    values: List<TenantTokenValueResponse>,
): JsonObject {
    val definitionJson = Json.encodeToJsonElement(TokenResponse.serializer(), definition)
    val family = familyKey(definition.type, definition.name)
    val members = if (family == null) {
        listOf(definition.id to definitionJson)
    } else {
        tokens.filter { familyKey(it.type, it.name) == family }
            .map { it.id to Json.encodeToJsonElement(DesignSystemTokenSummaryResponse.serializer(), it) }
    }
    val memberIds = members.map { it.first }.toSet()
    return buildJsonObject {
        put("definition", definitionJson)
        put("editRevision", JsonPrimitive(tenant.editRevision))
        put("members", JsonArray(members.map { it.second }))
        put(
            "values",
            JsonArray(
                values.filter { it.tokenId in memberIds }
                    .map { Json.encodeToJsonElement(TenantTokenValueResponse.serializer(), it) },
            ),
        )
    }
}

/** Ключ цветового семейства по правилу `ColorTokenFamily.of`; тип членов не сравнивается, как в MCP. */
private fun familyKey(type: String?, name: String): Pair<String, String>? =
    ThemeTokenType.fromWire(type)?.let { ColorTokenFamily.of(it, name) }?.let { it.group to it.name }
