package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.JsonObject

private val SCREEN_MODES = mapOf("screen-l" to "Large", "screen-m" to "Medium", "screen-s" to "Small")
private val VARIANTS = mapOf("normal" to "N", "medium" to "M", "bold" to "B")
private val HEADER_SIZE = Regex("^h\\d+$")

/** Коллекция `03. Typography` и текстовые стили с привязкой к её переменным. */
internal data class TypographyExportResult(
    val collection: PlanCollection,
    val textStyles: List<PlanTextStyle>,
    val skipped: List<PlanSkip>,
    val omittedDisabled: Int,
)

private data class StyleVariant(
    val id: String,
    val baseName: String,
    val family: String,
    val fontName: String,
    val weight: Int,
    val size: Double,
    val lineHeight: Double,
    val letterSpacing: Double,
)

/**
 * Каждый стиль и вариант начертания даёт переменные `Font Size`, `Line Height`, `Letter Spacing` в px и
 * `Font Weight` со значениями экранов в режимах; семейства — строковые `FontFamily/<Имя>`.
 */
internal class TypographyExport(source: JsonObject) {
    private val typography = source["typography"].obj()
    private val disabledTokens = source["tokens"].arr().mapNotNull { it.obj() }
        .filter { it.bool("enabled") == false }
        .mapNotNull { it.str("id") }
        .toSet()
    private val skipped = mutableListOf<PlanSkip>()
    private val disabled = mutableSetOf<String>()
    private val fonts = typography?.get("families").arr().mapNotNull { it.obj() }
        .associate { it.str("name").orEmpty() to (it.str("fontName") ?: it.str("name").orEmpty()) }

    fun build(): TypographyExportResult {
        val screens = typography?.get("screens").arr().mapNotNull { it.obj() }
        val order = SCREEN_MODES.keys.toList()
        // Три экрана образца есть всегда; экран без данных берёт значения первого доступного.
        val extra = screens.mapNotNull { it.str("screen") }.filter { it !in order }
        val modes = if (screens.isEmpty()) emptyList() else (order + extra).map { PlanMode(it, SCREEN_MODES[it] ?: it) }
        val byScreen = screens.associate { screen -> screen.str("screen").orEmpty() to variants(screen) }
        val ids = byScreen.values.flatMap { it.keys }.distinct()
        val families = byScreen.values.flatMap { it.values }.map { it.family to it.fontName }.distinct()
        val familyVariables = families.distinctBy { it.first }.map { (family, fontName) ->
            PlanVariable(
                key = "font-family:$family",
                name = "FontFamily/${capitalized(family)}",
                type = "STRING",
                scopes = listOf("FONT_FAMILY"),
                values = modes.associate { it.key to PlanValue.Text(fontName) },
            )
        }
        val styleVariables = mutableListOf<PlanVariable>()
        val textStyles = ids.mapNotNull { id ->
            val perScreen = modes.associate { mode -> mode.key to byScreen[mode.key]?.get(id) }
            val first = perScreen.values.firstNotNullOfOrNull { it } ?: return@mapNotNull null
            val values = perScreen.mapValues { (_, variant) -> variant ?: first }
            styleVariables += FIELDS.map { field ->
                PlanVariable(
                    key = "typography:$id:${field.key}",
                    name = "${first.baseName}/${field.label}",
                    type = "FLOAT",
                    scopes = listOf(field.scope),
                    values = values.mapValues { (_, variant) -> PlanValue.Number(field.value(variant)) },
                )
            }
            textStyle(id, first)
        }
        val variables = familyVariables + styleVariables
        return TypographyExportResult(
            PlanCollection("collection:typography", "03. Typography", modes, variables),
            textStyles,
            skipped.distinct(),
            disabled.size,
        )
    }

    private fun variants(screen: JsonObject): Map<String, StyleVariant> = screen["styles"].arr()
        .mapNotNull { it.obj() }
        .flatMap { style ->
            val group = style.str("group").orEmpty()
            val size = style.str("size").orEmpty()
            val family = style.str("fontFamily").orEmpty()
            val sizePx = style.num("sizePx") ?: 0.0
            style["variants"].obj().orEmpty().mapNotNull { (variant, raw) ->
                val data = raw.obj() ?: return@mapNotNull null
                val id = "$group.$size.$variant"
                val tokenId = data.str("tokenId")
                if (tokenId in disabledTokens) return@mapNotNull null.also { disabled += tokenId.orEmpty() }
                val weight = data.num("weight")?.toInt()
                if (weight == null) {
                    skipped += PlanSkip(id, "у варианта нет насыщенности")
                    return@mapNotNull null
                }
                id to StyleVariant(
                    id = id,
                    baseName = "${capitalized(group)}/${styleName(group, size)} ${variantCode(variant)}",
                    family = family,
                    fontName = fonts[family] ?: family,
                    weight = weight,
                    size = sizePx,
                    lineHeight = style.num("lineHeightPx") ?: sizePx,
                    letterSpacing = (style.num("letterSpacingEm") ?: 0.0) * sizePx,
                )
            }
        }
        .toMap()

    private fun textStyle(id: String, variant: StyleVariant) = PlanTextStyle(
        key = "text-style:$id",
        name = variant.baseName,
        fontFamily = variant.fontName,
        fontWeight = variant.weight,
        fontSize = variant.size,
        lineHeight = variant.lineHeight,
        letterSpacing = variant.letterSpacing,
        bindings = FIELDS.associate { it.binding to "typography:$id:${it.key}" } +
            ("fontFamily" to "font-family:${variant.family}"),
    )

    private class Field(
        val key: String,
        val label: String,
        val scope: String,
        val binding: String,
        val value: (StyleVariant) -> Double,
    )

    private companion object {
        val FIELDS = listOf(
            Field("size", "Font Size", "FONT_SIZE", "fontSize") { it.size },
            Field("line-height", "Line Height", "LINE_HEIGHT", "lineHeight") { it.lineHeight },
            Field("letter-spacing", "Letter Spacing", "LETTER_SPACING", "letterSpacing") { it.letterSpacing },
            Field("weight", "Font Weight", "FONT_WEIGHT", "fontWeight") { it.weight.toDouble() },
        )
    }
}

/** `h1` → `H1`, иначе группа и размер: `body` + `xs` → `BodyXS`. */
internal fun styleName(group: String, size: String): String =
    if (HEADER_SIZE.matches(size)) size.uppercase() else capitalized(group) + size.uppercase()

/** `bold` → `B`, как в образце; неизвестный вариант — с заглавной буквы. */
internal fun variantCode(variant: String): String = VARIANTS[variant] ?: capitalized(variant)

internal fun capitalized(value: String): String = value.replaceFirstChar { it.uppercaseChar() }
