package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private const val NAME_SEGMENTS = 3
private val STATE_SUFFIXES = listOf("hover", "active", "brightness")
private const val BACKGROUND = "background"
private const val DEFAULT_CONTEXT = "default"
private val CONTEXTS = listOf(DEFAULT_CONTEXT, "on-dark", "on-light", "inverse")
private val CONTEXT_NAMES = mapOf(
    DEFAULT_CONTEXT to "Default",
    "on-dark" to "onDark",
    "on-light" to "onLight",
    "inverse" to "Inverse",
)
private val BACKGROUND_CONTEXTS = mapOf("dark" to "on-dark", "light" to "on-light")
private val THEME_MODES = listOf(PlanMode("light", "Light"), PlanMode("dark", "Dark"))
private val PALETTE_REF = Regex("""^\[(general|additional)\.([A-Za-z0-9]+)\.(\d+)\](?:\[(\d+(?:\.\d+)?)\])?$""")
private val ALL_SCOPES = listOf("ALL_SCOPES")

/** Коллекции цвета, стили градиентов и пропуски. */
internal data class ColorExportResult(
    val palette: PlanCollection,
    val theme: PlanCollection,
    val subTheme: PlanCollection,
    val paintStyles: List<PlanPaintStyle>,
    val skipped: List<PlanSkip>,
    val omittedDisabled: Int,
)

private data class TokenGroup(val id: String, val parentId: String?, val label: String)

/** Цветовой токен с разобранным именем Figma. */
private data class ThemeToken(
    val id: String,
    val name: String,
    val type: String,
    val context: String,
    val themeName: String,
    val subThemeName: String,
)

private data class PaletteSlot(val groupId: String, val type: String, val shade: String, val step: Int)

/**
 * Цвета темы в структуре образца: `00. Palette`, `01. Theme` со ссылками на палитру и `02. SubTheme` со ссылками
 * на тему. Имена берутся из подписей групп токенов, поэтому новые группы попадают в Figma без изменения кода.
 */
internal class ColorExport(source: JsonObject) {
    private val tokens = source["tokens"].arr().mapNotNull { it.obj() }
    private val webValues = source["values"].arr().mapNotNull { it.obj() }
        .filter { it.str("platform") == "web" }
        .groupBy { it.str("tokenId") }
    private val palette = source["palette"].obj()
    private val groups = source["groups"].arr().mapNotNull { it.obj() }.mapNotNull { group ->
        val id = group.str("id") ?: return@mapNotNull null
        TokenGroup(id, group.str("parentId"), group.str("label").orEmpty())
    }.associateBy { it.id }
    private val tokenPaletteGroups = palette?.get("tokens").arr().mapNotNull { it.obj() }
        .mapNotNull { assignment -> assignment.str("tokenId")?.let { it to assignment.str("groupId") } }
        .toMap()
    private val paletteKeys = mutableMapOf<PaletteSlot, String>()
    private val skipped = mutableListOf<PlanSkip>()
    private var disabled = 0

    fun build(): ColorExportResult {
        val paletteCollection = paletteCollection()
        val themeVariables = mutableListOf<PlanVariable>()
        val themeTokens = mutableListOf<ThemeToken>()
        val paintStyles = mutableListOf<PlanPaintStyle>()
        val usedNames = mutableMapOf<String, String>()
        candidates().forEach { token ->
            val owner = usedNames[token.themeName]
            if (owner != null) {
                skipped += PlanSkip(token.name, "имя Figma ${token.themeName} уже занято токеном $owner")
                return@forEach
            }
            val modes = modeValues(token.id)
            val solid = modes.mapValues { (_, layers) -> layers.singleOrNull()?.let(::parseHex) }
            val added = when {
                modes.isEmpty() -> false.also { skipped += PlanSkip(token.name, "нет значений web") }
                solid.values.all { it != null } -> {
                    themeVariables += themeVariable(token, modes, solid.mapValues { it.value!! })
                    themeTokens += token
                    true
                }
                token.type == "gradient" -> gradientStyles(token, modes).also { paintStyles += it }.isNotEmpty()
                else -> false.also {
                    skipped += PlanSkip(token.name, "значение не цвет: ${modes.values.flatten().first()}")
                }
            }
            // Имя занимает только экспортированный токен: пропущенный не отнимает его у следующего.
            if (added) usedNames[token.themeName] = token.name
        }
        return ColorExportResult(
            palette = paletteCollection,
            theme = PlanCollection("collection:theme", "01. Theme", THEME_MODES, themeVariables),
            subTheme = subThemeCollection(themeTokens),
            paintStyles = paintStyles,
            skipped = skipped.toList(),
            omittedDisabled = disabled,
        )
    }

    private fun paletteCollection(): PlanCollection {
        val names = mutableSetOf<String>()
        val variables = palette?.get("groups").arr().mapNotNull { it.obj() }.flatMap { group ->
            val groupId = group.str("id").orEmpty()
            val label = segment(group.str("label").orEmpty())
            val ramps = group["ramps"].arr().mapNotNull { it.obj() }
            val displayNames = ramps.groupingBy { it.str("displayName") }.eachCount()
            ramps.flatMap { ramp ->
                val slot = ramp["slot"].obj()
                val type = slot?.str("type").orEmpty()
                val shade = slot?.str("shade").orEmpty()
                val display = ramp.str("displayName") ?: shade
                // Две шкалы группы с одним названием (`general.green` и `additional.h130`) различаются слотом.
                val rampName = segment(if ((displayNames[display] ?: 0) > 1) "$display ($type.$shade)" else display)
                ramp["steps"].arr().mapNotNull { it.obj() }.mapNotNull { step ->
                    val number = step.num("step")?.toInt() ?: return@mapNotNull null
                    val color = step.str("value")?.let(::parseHex) ?: return@mapNotNull null
                    val key = "palette:$groupId:$type.$shade.$number"
                    val name = "$label/$rampName/$number"
                    // Повтор имени пропускается здесь, чтобы тема не ссылалась на ступень, которой нет в плане.
                    if (!names.add(name)) {
                        skipped += PlanSkip(name, "имя уже есть в коллекции 00. Palette")
                        return@mapNotNull null
                    }
                    paletteKeys[PaletteSlot(groupId, type, shade, number)] = key
                    PlanVariable(
                        key,
                        name,
                        "COLOR",
                        emptyList(),
                        mapOf(SINGLE_MODE.key to PlanValue.Color(color)),
                    )
                }
            }
        }
        return PlanCollection("collection:palette", "00. Palette", listOf(SINGLE_MODE), variables)
    }

    /**
     * Включённые цвета с разобранным именем; остальные учитываются в пропусках. Состояния `-hover`, `-active`,
     * `-brightness` идут как обычные токены: суффикс становится частью листа имени (`PrimaryHover`).
     */
    private fun candidates(): List<ThemeToken> = tokens
        .filter { it.str("type") == "color" || it.str("type") == "gradient" }
        .mapNotNull { token ->
            val name = token.str("name").orEmpty()
            when {
                token.bool("enabled") == false -> null.also { disabled++ }
                else -> themeToken(token, name)
            }
        }

    private fun themeToken(token: JsonObject, name: String): ThemeToken? {
        val segments = name.split('.')
        val group = token.str("groupId")?.let(groups::get)
        val root = group?.parentId?.let(groups::get) ?: group
        val context = segments.getOrNull(1)?.let {
            if (segments[0] == BACKGROUND) BACKGROUND_CONTEXTS[it] ?: it else it
        }
        val reason = when {
            segments.size != NAME_SEGMENTS -> "имя не по правилу <группа>.<контекст>.<имя>"
            root == null -> "токен вне групп"
            context !in CONTEXTS -> "неизвестный контекст ${segments[1]}"
            else -> null
        }
        if (reason != null) {
            skipped += PlanSkip(name, reason)
            return null
        }
        val category = group?.takeIf { it.parentId != null }?.label?.split('/')?.map { it.trim() }
            ?.filter { it.isNotEmpty() }?.takeUnless { it == listOf("Default") }.orEmpty()
        // Состояние не участвует в сокращении по категории: `solid-hover` в «General / Solid» → `SolidHover`.
        val state = STATE_SUFFIXES.firstOrNull { segments[2].endsWith("-$it") }
        val base = state?.let { segments[2].removeSuffix("-$it") } ?: segments[2]
        val leaf = leafName(base, category) + state.orEmpty().replaceFirstChar { it.uppercaseChar() }
        val rootName = root!!.label.replace(" & ", "&").let(::segment)
        val contextName = if (segments[0] == BACKGROUND && context == DEFAULT_CONTEXT) null else CONTEXT_NAMES[context]
        return ThemeToken(
            id = token.str("id").orEmpty(),
            name = name,
            type = token.str("type").orEmpty(),
            context = context!!,
            themeName = (listOfNotNull(rootName, contextName) + category + leaf).joinToString("/"),
            subThemeName = (listOf(rootName) + category + leaf).joinToString("/"),
        )
    }

    /** Слои web по режиму; режим без значения получает значение другого режима. */
    private fun modeValues(tokenId: String): Map<String, List<String>> {
        val layers = THEME_MODES.associate { mode -> mode.key to layers(valueFor(tokenId, mode.key)) }
        return if (layers.values.all { it.isEmpty() }) emptyMap() else layers
    }

    /** Как в просмотре: точный режим, затем значение без режима; иначе — значение другого режима. */
    private fun valueFor(tokenId: String, mode: String): JsonObject? {
        val values = webValues[tokenId].orEmpty()
        return values.firstOrNull { it.str("mode") == mode }
            ?: values.firstOrNull { it.str("mode") == null }
            ?: values.firstOrNull()
    }

    private fun layers(value: JsonObject?): List<String> = when (val raw = value?.get("value")) {
        is JsonPrimitive -> listOfNotNull(raw.takeIf { it.isString }?.content)
        else -> raw.arr().mapNotNull { (it as? JsonPrimitive)?.takeIf { item -> item.isString }?.content }
    }

    private fun themeVariable(
        token: ThemeToken,
        modes: Map<String, List<String>>,
        colors: Map<String, PlanColor>,
    ): PlanVariable {
        val planned = modes.keys.associateWith { mode ->
            val reference = valueFor(token.id, mode)?.str("paletteRef")
            reference?.let { paletteAlias(token.id, it) } ?: PlanValue.Color(colors.getValue(mode))
        }
        return PlanVariable("theme:${token.id}", token.themeName, "COLOR", emptyList(), planned)
    }

    /** Ссылка на ступень палитры той группы, к которой привязан токен; иначе `null`. */
    private fun paletteAlias(tokenId: String, reference: String): PlanValue.Alias? {
        val match = PALETTE_REF.matchEntire(reference.trim()) ?: return null
        val groupId = tokenPaletteGroups[tokenId] ?: return null
        val (type, shade, step, opacity) = match.destructured
        val key = paletteKeys[PaletteSlot(groupId, type, shade, step.toInt())] ?: return null
        val alpha = opacity.toDoubleOrNull()?.takeIf { it < 1.0 }
        return PlanValue.Alias(key, alpha?.let(::opacityPercent))
    }

    private fun gradientStyles(token: ThemeToken, modes: Map<String, List<String>>): List<PlanPaintStyle> {
        val paints = modes.mapValues { (_, layers) -> layers.map(::parsePaint) }
        val broken = paints.values.any { layers -> layers.isEmpty() || layers.any { it == null } }
        if (broken) {
            val raw = modes.values.flatten().distinct().joinToString()
            skipped += PlanSkip(token.name, "не удалось разобрать градиент: $raw")
            return emptyList()
        }
        return THEME_MODES.map { mode ->
            PlanPaintStyle(
                key = "gradient:${token.id}:${mode.key}",
                name = "${mode.name}/${token.themeName}",
                paints = paints.getValue(mode.key).filterNotNull(),
            )
        }
    }

    /** Подтема ссылается на тему своего контекста, а без него — на контекст `default`. */
    private fun subThemeCollection(themeTokens: List<ThemeToken>): PlanCollection {
        val variables = themeTokens.groupBy { it.subThemeName }.map { (name, family) ->
            val byContext = family.associateBy { it.context }
            // Без контекста default берётся первый по порядку контекстов, а не по порядку ответа API: ключ стабилен.
            val fallback = CONTEXTS.firstNotNullOf { byContext[it] }
            PlanVariable(
                // Ключ по токену, а не по имени: переименование в DS Builder обновляет ту же переменную.
                key = "subtheme:${fallback.id}",
                name = name,
                type = "COLOR",
                scopes = ALL_SCOPES,
                values = CONTEXTS.associateWith { context ->
                    PlanValue.Alias("theme:${(byContext[context] ?: fallback).id}")
                },
            )
        }
        val modes = CONTEXTS.map { PlanMode(it, CONTEXT_NAMES.getValue(it)) }
        return PlanCollection("collection:subtheme", "02. SubTheme", modes, variables)
    }
}

/** Единственный режим коллекций без режимов. */
internal val SINGLE_MODE: PlanMode = PlanMode("default", "Default")

/** Сегмент имени Figma не может содержать `/`: он разделяет группы. */
internal fun segment(label: String): String = label.replace('/', '-').trim()

/**
 * Последний сегмент имени токена в PascalCase. У составной категории («Accent / Transparent») начальное слово,
 * повторяющее её конец, отбрасывается: `transparent-accent` → `Accent`. У простой категории имя не меняется:
 * `accent-minor` в «Accent» остаётся `AccentMinor`, как в образце.
 */
internal fun leafName(member: String, category: List<String>): String {
    val words = member.split('-').filter { it.isNotEmpty() }
    val repeats = category.size > 1 && words.size > 1 && words.first().equals(category.last(), ignoreCase = true)
    val trimmed = if (repeats) words.drop(1) else words
    return trimmed.joinToString("") { word -> word.replaceFirstChar { it.uppercaseChar() } }
}
