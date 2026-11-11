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
        val colors = ColorExport(source, theme.platform).build()
        val typography = TypographyExport(source).build()
        val sizes = source["sizes"].obj()
        val skipped = mutableListOf<PlanSkip>()
        val disabled = source["tokens"].arr().mapNotNull { it.obj() }
            .filter { it.bool("enabled") == false }
            .mapNotNull { it.str("id") }
            .toSet()
        val omitted = mutableSetOf<String>()
        // Пропуски теней идут в отчёте после размеров, хотя тени строятся раньше: им нужна коллекция темы.
        val shadowSkips = mutableListOf<PlanSkip>()
        val shadowNotes = mutableListOf<PlanSkip>()
        val shadows =
            shadows(sizes, colors.palette, Filter(disabled, omitted, shadowSkips), shadowNotes, theme.platform)
        val collections = listOf(
            colors.palette,
            colors.theme.copy(variables = colors.theme.variables + shadows.variables),
            colors.subTheme,
            typography.collection,
            sampleRadii(dimensions(sizes, RADII, Filter(disabled, omitted, skipped), theme.platform)),
            dimensions(sizes, SPACING, Filter(disabled, omitted, skipped), theme.platform),
        ).map { uniqueNames(it, skipped) }
        return FigmaExportPlan(
            source = theme,
            collections = collections,
            textStyles = typography.textStyles,
            effectStyles = shadows.styles,
            paintStyles = colors.paintStyles,
            skipped = colors.skipped + typography.skipped + skipped + shadowSkips,
            omittedDisabled = colors.omittedDisabled + typography.omittedDisabled + omitted.size,
            fontFiles = fontFiles(source, typography.textStyles.map { it.fontFamily }.distinct()),
            notes = colors.notes + shadowNotes,
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
            // Внутренний радиус есть всегда, а не только от 2 px: набор переменных не зависит от платформы.
            if (size != null && value != null) {
                result += variable.copy(
                    key = "radii-inner:${variable.key}",
                    name = "${prefix}calc:[cR$size-2]",
                    values = mapOf(SINGLE_MODE.key to PlanValue.Number(maxOf(0.0, value - INNER_OFFSET))),
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

    /** Число платформы из `native`, если оно есть, иначе web; полное скругление одинаково на всех платформах. */
    private fun dimensions(sizes: JsonObject?, dimension: Dimension, filter: Filter, platform: String): PlanCollection {
        val used = mutableSetOf<String>()
        val variables = sizes?.get(dimension.section).arr().mapNotNull { it.obj() }.mapNotNull { token ->
            val id = token.str("tokenId")?.takeIf(filter::enabled) ?: return@mapNotNull null
            val name = token.str("name").orEmpty()
            val native = token["native"].obj()?.num(platform)?.takeIf { platform != WEB }
            val value = if (token.bool("fullRounding") == true) FULL_ROUNDING else native ?: token.num("valuePx")
            if (value == null) filter.skipped += PlanSkip(name, "нет значения в px")
            value?.let {
                PlanVariable(
                    key = "${dimension.section.removeSuffix("s")}:$id",
                    // Имя по значению web: смена платформы не переименовывает `null` и `cR…`.
                    name = "${dimension.prefix}/${segment(
                        leafFor(dimension, name, token.num("valuePx") ?: it, token, used),
                    )}",
                    type = "FLOAT",
                    scopes = listOf(dimension.scope),
                    values = mapOf(SINGLE_MODE.key to PlanValue.Number(it)),
                )
            }
        }
        return PlanCollection(dimension.key, dimension.name, listOf(SINGLE_MODE), variables)
    }

    /** Стили теней и переменные цветов их слоёв. */
    private class ShadowExport(val styles: List<PlanEffectStyle>, val variables: List<PlanVariable>)

    /**
     * Тень с нераспознанным цветом слоя пропускается целиком: частичная тень вводила бы в заблуждение. Слой со ссылкой
     * на палитру `colorRef` получает переменную `ShadowColors/<тень>/Layer N` в `01. Theme`: ссылку на ступень с
     * прозрачностью слоя, к которой привязан цвет эффекта, поэтому тень меняется вслед за палитрой.
     */
    private fun shadows(
        sizes: JsonObject?,
        palette: PlanCollection,
        filter: Filter,
        notes: MutableList<PlanSkip>,
        platform: String,
    ): ShadowExport {
        val variables = mutableListOf<PlanVariable>()
        val styles = sizes?.get("shadows").arr().mapNotNull { it.obj() }.mapNotNull { token ->
            val id = token.str("tokenId")?.takeIf(filter::enabled) ?: return@mapNotNull null
            // Слои платформы из `native`, если они есть, иначе web.
            val native = token["native"].obj()?.get(platform).obj()?.get("layers").arr().takeIf { platform != WEB }
            val raw = (native?.takeIf { it.isNotEmpty() } ?: token["layers"].arr()).mapNotNull { it.obj() }
            val name = token.str("name").orEmpty().split('.').filter { it.isNotEmpty() }
                .joinToString("/") { capitalized(segment(it)) }
            val layerVariables = mutableListOf<PlanVariable>()
            val layers = raw.mapIndexedNotNull { index, layer ->
                val color = layer.str("color")?.let(::parseHex) ?: return@mapIndexedNotNull null
                val reference = layer.str("colorRef")
                val alias = reference?.let { shadowAlias(palette, it, color) }
                if (reference != null && alias == null) {
                    notes += PlanSkip(
                        token.str("name").orEmpty(),
                        "цвет слоя тени не привязан к палитре: в плане нет ступени $reference с цветом слоя",
                    )
                }
                val colorKey = alias?.let {
                    val key = "shadow-color:$id:$index"
                    layerVariables += PlanVariable(
                        key = key,
                        name = "ShadowColors/$name/Layer ${index + 1}",
                        type = "COLOR",
                        scopes = listOf("EFFECT_COLOR"),
                        values = mapOf("light" to it, "dark" to it),
                    )
                    key
                }
                PlanShadow(
                    x = layer.num("offsetX") ?: 0.0,
                    y = layer.num("offsetY") ?: 0.0,
                    blur = layer.num("blur") ?: 0.0,
                    spread = layer.num("spread") ?: 0.0,
                    color = color,
                    colorKey = colorKey,
                )
            }
            if (layers.size != raw.size || layers.isEmpty()) {
                filter.skipped += PlanSkip(token.str("name").orEmpty(), "у тени нет слоёв или цвет слоя не распознан")
                null
            } else {
                variables += layerVariables
                PlanEffectStyle("shadow:$id", "Shadows/$name", layers)
            }
        }
        return ShadowExport(styles, variables)
    }

    /**
     * Ссылка цвета слоя на ступень палитры. Группу палитры для тени выбирает бэкенд, поэтому берётся группа, где
     * значение ступени совпадает с раскрытым цветом слоя; без совпадения — `null`, и слой сохраняет HEX. Прозрачность —
     * из ссылки, а если её там нет — из альфы раскрытого цвета.
     */
    private fun shadowAlias(palette: PlanCollection, reference: String, color: PlanColor): PlanValue.Alias? {
        val match = PALETTE_REF.matchEntire(reference.trim()) ?: return null
        val (type, shade, step, opacity) = match.destructured
        val target = palette.variables.filter { it.key.endsWith(":$type.$shade.$step") }.firstOrNull { variable ->
            val value = (variable.values[SINGLE_MODE.key] as? PlanValue.Color)?.color
            value != null && value.r == color.r && value.g == color.g && value.b == color.b
        } ?: return null
        val alpha = (opacity.toDoubleOrNull() ?: color.a).takeIf { it < 1.0 }
        return PlanValue.Alias(target.key, alpha?.let(::opacityPercent))
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
