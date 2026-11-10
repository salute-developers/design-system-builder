package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.JsonObject

/** Полное скругление, как `Rounded` в образце: радиус больше любой стороны. */
private const val FULL_ROUNDING = 1000.0

/** Внутренний радиус вложенного элемента в образце: внешний минус 2. */
private const val INNER_OFFSET = 2.0

/** Скругления, у которых в образце есть внутренний радиус `calc:[cR<размер>-2]`. */
private val INNER_RADII = listOf("xxs", "m", "l", "xl")

/**
 * План экспорта темы в Figma из ответа [com.dsbuilder.frontend.feature.ds.application.ThemeTokensClient.exportSource].
 * Чистая функция: сеть и документ Figma ей не нужны.
 */
internal object FigmaExportPlanner {
    fun plan(source: JsonObject, theme: ExportThemeInfo): FigmaExportPlan {
        val colors = ColorExport(source).build()
        val typography = TypographyExport(source).build()
        val sizes = source["sizes"].obj()
        val skipped = mutableListOf<PlanSkip>()
        val disabled = source["tokens"].arr().mapNotNull { it.obj() }
            .filter { it.bool("enabled") == false }
            .mapNotNull { it.str("id") }
            .toSet()
        val omitted = mutableSetOf<String>()
        val collections = listOf(
            colors.palette,
            colors.theme,
            colors.subTheme,
            typography.collection,
            sampleRadii(dimensions(sizes, RADII, Filter(disabled, omitted, skipped))),
            dimensions(sizes, SPACING, Filter(disabled, omitted, skipped)),
        ).map { uniqueNames(it, skipped) }
        val effectStyles = shadows(sizes, Filter(disabled, omitted, skipped))
        return FigmaExportPlan(
            source = theme,
            collections = collections,
            textStyles = typography.textStyles,
            effectStyles = effectStyles,
            paintStyles = colors.paintStyles,
            skipped = colors.skipped + typography.skipped + skipped,
            omittedDisabled = colors.omittedDisabled + typography.omittedDisabled + omitted.size,
            fontFiles = fontFiles(source, typography.textStyles.map { it.fontFamily }.distinct()),
            notes = colors.notes,
        )
    }

    /** Выключенные токены, счётчик пропущенных из них и пропуски с причиной. */
    private class Filter(
        val disabled: Set<String>,
        val omitted: MutableSet<String>,
        val skipped: MutableList<PlanSkip>,
    ) {
        fun enabled(id: String): Boolean = (id !in disabled).also { if (!it) omitted += id }
    }

    /**
     * Дополняет скругления до набора образца: `null` = 0 есть всегда, а у `cRxxs`, `cRm`, `cRl`, `cRxl` появляется
     * внутренний радиус `calc:[cR<размер>-2]` сразу после основного.
     */
    private fun sampleRadii(collection: PlanCollection): PlanCollection {
        val prefix = "${RADII.prefix}/"
        val zero = PlanValue.Number(0.0)
        val result = mutableListOf<PlanVariable>()
        if (collection.variables.none { it.name == "${prefix}null" }) {
            val values = mapOf(SINGLE_MODE.key to zero)
            result += PlanVariable("radii:null", "${prefix}null", "FLOAT", listOf(RADII.scope), values)
        }
        collection.variables.forEach { variable ->
            result += variable
            val size = INNER_RADII.firstOrNull { variable.name == "${prefix}cR$it" }
            val value = (variable.values[SINGLE_MODE.key] as? PlanValue.Number)?.value
            if (size != null && value != null && value >= INNER_OFFSET) {
                result += variable.copy(
                    key = "radii-inner:${variable.key}",
                    name = "${prefix}calc:[cR$size-2]",
                    values = mapOf(SINGLE_MODE.key to PlanValue.Number(value - INNER_OFFSET)),
                )
            }
        }
        return collection.copy(variables = result)
    }

    /** Имя переменной в коллекции Figma уникально: повтор пропускается с причиной, а не ломает запись. */
    private fun uniqueNames(collection: PlanCollection, skipped: MutableList<PlanSkip>): PlanCollection {
        val seen = mutableSetOf<String>()
        val variables = collection.variables.filter { variable ->
            seen.add(variable.name).also { unique ->
                if (!unique) skipped += PlanSkip(variable.name, "имя уже есть в коллекции ${collection.name}")
            }
        }
        return collection.copy(variables = variables)
    }

    /** Раздел размеров и его коллекция. */
    private class Dimension(
        val section: String,
        val key: String,
        val name: String,
        val prefix: String,
        val scope: String,
        /** Лист имени переменной по хвосту имени токена, значению и признаку полного скругления. */
        val leaf: (tail: String, value: Double, full: Boolean) -> String,
    )

    private fun dimensions(sizes: JsonObject?, dimension: Dimension, filter: Filter): PlanCollection {
        val used = mutableSetOf<String>()
        val variables = sizes?.get(dimension.section).arr().mapNotNull { it.obj() }.mapNotNull { token ->
            val id = token.str("tokenId")?.takeIf(filter::enabled) ?: return@mapNotNull null
            val name = token.str("name").orEmpty()
            val value = if (token.bool("fullRounding") == true) FULL_ROUNDING else token.num("valuePx")
            if (value == null) filter.skipped += PlanSkip(name, "нет значения в px")
            value?.let {
                PlanVariable(
                    key = "${dimension.section.removeSuffix("s")}:$id",
                    name = "${dimension.prefix}/${segment(leafFor(dimension, name, it, token, used))}",
                    type = "FLOAT",
                    scopes = listOf(dimension.scope),
                    values = mapOf(SINGLE_MODE.key to PlanValue.Number(it)),
                )
            }
        }
        return PlanCollection(dimension.key, dimension.name, listOf(SINGLE_MODE), variables)
    }

    /** Тень с нераспознанным цветом слоя пропускается целиком: частичная тень вводила бы в заблуждение. */
    private fun shadows(sizes: JsonObject?, filter: Filter): List<PlanEffectStyle> =
        sizes?.get("shadows").arr().mapNotNull { it.obj() }.mapNotNull { token ->
            val id = token.str("tokenId")?.takeIf(filter::enabled) ?: return@mapNotNull null
            val raw = token["layers"].arr().mapNotNull { it.obj() }
            val layers = raw.mapNotNull { layer ->
                val color = layer.str("color")?.let(::parseHex) ?: return@mapNotNull null
                PlanShadow(
                    x = layer.num("offsetX") ?: 0.0,
                    y = layer.num("offsetY") ?: 0.0,
                    blur = layer.num("blur") ?: 0.0,
                    spread = layer.num("spread") ?: 0.0,
                    color = color,
                )
            }
            val name = token.str("name").orEmpty().split('.').filter { it.isNotEmpty() }
                .joinToString("/") { capitalized(segment(it)) }
            if (layers.size != raw.size || layers.isEmpty()) {
                filter.skipped += PlanSkip(token.str("name").orEmpty(), "у тени нет слоёв или цвет слоя не распознан")
                null
            } else {
                PlanEffectStyle("shadow:$id", "Shadows/$name", layers)
            }
        }

    /** Скругления по образцу `DS BUILDER | STYLES`: `cRm`, `null` для нуля и `Rounded` для полного скругления. */
    private val RADII = Dimension("radii", "collection:numbers", "04. Numbers", "CornerRadius", "CORNER_RADIUS") {
            tail, value, full ->
        when {
            full -> "Rounded"
            value == 0.0 -> "null"
            else -> "cR$tail"
        }
    }
    private val SPACING =
        Dimension("spacing", "collection:spacing", "05. Spacing", "Spacing", "GAP") { tail, _, _ -> tail }

    /** `null` и `Rounded` достаются первому подходящему токену, следующие называются по своему имени: `cR<хвост>`. */
    private fun leafFor(
        dimension: Dimension,
        name: String,
        value: Double,
        token: JsonObject,
        used: MutableSet<String>,
    ): String {
        val leaf = dimension.leaf(tail(name), value, token.bool("fullRounding") == true)
        val unique = if (leaf in used && dimension === RADII) "cR${tail(name)}" else leaf
        used += unique
        return unique
    }

    private fun tail(name: String): String = name.substringAfter('.', name)
}
