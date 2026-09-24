package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.plugin.androidstudio.codereference.ClipboardCopier
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GradientLayer
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ShadowLayerValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenType
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenValuePayload
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.Divider
import com.sdds.compose.uikit.IconButton
import com.sdds.compose.uikit.ListItem
import com.sdds.compose.uikit.TextField
import com.sdds.compose.uikit.graphics.Gradients
import com.sdds.compose.uikit.shadow.ShadowAppearance
import com.sdds.compose.uikit.shadow.ShadowLayer
import com.sdds.compose.uikit.shadow.shadow
import com.sdds.icons.compose.CopyOutline24
import com.sdds.icons.compose.SddsIcons
import com.sdds.serv.styles.divider.DividerStyles
import com.sdds.serv.styles.divider.style
import com.sdds.serv.styles.iconbutton.IconButtonStyles
import com.sdds.serv.styles.iconbutton.style
import com.sdds.serv.styles.listitem.ListItemStyles
import com.sdds.serv.styles.listitem.style
import com.sdds.serv.styles.textfield.TextFieldStyles
import com.sdds.serv.styles.textfield.style
import com.sdds.serv.theme.SddsServTheme
import kotlinx.coroutines.launch

/** Общий размер превью для `color`/`gradient`/`shadow` — одинаковый, чтобы список не «прыгал». */
private val TYPE_SWATCH_SIZE = 64.dp
private val SWATCH_SHAPE = RoundedCornerShape(8.dp)

/** Вкладка над списком токенов: либо один из встречающихся [TokenType], либо "прочее" (`null`). */
private typealias TypeFilter = TokenType?

/**
 * Список токенов выбранной дизайн-системы: сегмент типа токена (когда типов больше одного)
 * и поиск по имени внутри выбранного типа; [modeToggle] — кнопка режима темы справа от поиска, блокируется
 * на типах, значение которых не зависит от темы.
 * Компоненты — из `sdds-uikit-compose`/`sdds-serv`, как и остальной UI плагина. Read-only — ничего не пишет ни в проект пользователя.
 */
@Composable
public fun TokenList(
    tokens: List<TokenWithValue>,
    selectedTabIndex: Int,
    onTabSelected: (Int) -> Unit,
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    resolveCodeReference: (suspend (TokenWithValue) -> TokenCodeReferenceResult)? = null,
    modeToggle: @Composable (enabled: Boolean) -> Unit = {},
) {
    // FONT_FAMILY нечего показывать пользователю осмысленно — значение это просто имя шрифта,
    // отдельная вкладка под него не нужна.
    val visibleTypeTokens = remember(tokens) { tokens.filter { it.token.type != TokenType.FONT_FAMILY } }
    val types = remember(visibleTypeTokens) { orderedTokenTypes(visibleTypeTokens.map { it.token.type }) }
    // Вкладка и поиск хранятся снаружи (MainScreenState) и переживают сворачивание панели;
    // если типов стало меньше, индекс подрезается до допустимого.
    val selectedIndex = selectedTabIndex.coerceIn(0, (types.size - 1).coerceAtLeast(0))
    val selectedType = types.getOrNull(selectedIndex)

    val visibleTokens = remember(visibleTypeTokens, selectedType, query) {
        visibleTypeTokens
            .asSequence()
            .filter { it.token.type == selectedType }
            .filter { item -> query.isBlank() || item.matchesQuery(query) }
            .toList()
    }

    Column(modifier.fillMaxSize()) {
        // Единственный владелец вертикального ритма экрана: у блоков внутри своих вертикальных
        // отступов нет, шаг между ними и отступ снизу до списка — один и тот же (spacing4x). Сверху
        // достаточно spacing2x: к нему добавляется нижний отступ хлебных крошек, в сумме тоже шаг.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = SddsServTheme.spacing.spacing4x,
                    end = SddsServTheme.spacing.spacing4x,
                    top = SddsServTheme.spacing.spacing2x,
                    bottom = SddsServTheme.spacing.spacing4x,
                ),
            verticalArrangement = Arrangement.spacedBy(SddsServTheme.spacing.spacing4x),
        ) {
            if (types.size > 1) {
                FilterSegment(
                    items = types,
                    selectedIndex = selectedIndex,
                    label = { it.label() },
                    onSelect = onTabSelected,
                    scrollable = true,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(SddsServTheme.spacing.spacing2x),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TokenSearchField(query = query, onQueryChange = onQueryChange, modifier = Modifier.weight(1f))
                modeToggle(selectedType.isThemeDependent())
            }
        }

        if (visibleTokens.isEmpty()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { NoMatchesText() }
        } else {
            // Ленивый список: в дизайн-системе сотни цветов, композировать их все сразу — фризы при прокрутке.
            // Divider приходит с тем же стилем, что и раньше, — дорогой `style()` считается один раз, а не на строку.
            val dividerStyle = DividerStyles.DividerDefault.style()
            LazyColumn(Modifier.fillMaxSize()) {
                items(items = visibleTokens, key = { it.token.id }) { item ->
                    TokenRow(item, resolveCodeReference)
                    Divider(style = dividerStyle)
                }
            }
        }
    }
}

/**
 * Значение токена зависит от режима темы только у цветов и градиентов; у остальных типов
 * (`typography`, `spacing`, `shape`, `shadow`) значение одно на обе темы, и выбор режима для них бессмыслен.
 */
internal fun TokenType?.isThemeDependent(): Boolean = this == TokenType.COLOR || this == TokenType.GRADIENT

/** Фиксированный порядок вкладок — не зависит от того, в каком порядке типы пришли в конкретной дизайн-системе. */
private val TAB_TYPE_ORDER = listOf(
    TokenType.COLOR,
    TokenType.GRADIENT,
    TokenType.TYPOGRAPHY,
    TokenType.SHADOW,
    TokenType.SHAPE,
    TokenType.SPACING,
)

/** Уникальные типы в порядке [TAB_TYPE_ORDER]; неизвестный тип (`null`, вкладка «Другое») — последним. */
internal fun orderedTokenTypes(types: List<TokenType?>): List<TokenType?> =
    types.distinct().sortedBy { type -> TAB_TYPE_ORDER.indexOf(type).takeIf { it >= 0 } ?: Int.MAX_VALUE }

/**
 * Показывает цвет в Android-порядке `#AARRGGBB` (как `Color(0xAARRGGBB)` в Compose). Источник хранит
 * `#RRGGBBAA` (прозрачность в конце) или шестизначный `#RRGGBB`: в первом случае альфа переносится
 * в начало, второй получает `FF` (непрозрачный). Регистр — верхний, не hex остаётся как есть.
 */
internal fun formatHexAarrggbb(hex: String): String {
    val digits = hex.trim().removePrefix("#").uppercase()
    if (digits.any { !it.isDigit() && it !in 'A'..'F' }) return hex
    return when (digits.length) {
        RGB_DIGITS -> "#FF$digits"
        RGBA_DIGITS -> "#${digits.substring(RGB_DIGITS)}${digits.substring(0, RGB_DIGITS)}"
        else -> hex
    }
}

private const val RGB_DIGITS = 6
private const val RGBA_DIGITS = 8

private fun TokenWithValue.matchesQuery(query: String): Boolean =
    token.name.contains(query, ignoreCase = true) || token.displayName?.contains(query, ignoreCase = true) == true

private fun TypeFilter.label(): String = when (this) {
    TokenType.COLOR -> "Цвета"
    TokenType.GRADIENT -> "Градиенты"
    TokenType.TYPOGRAPHY -> "Типографика"
    TokenType.SHADOW -> "Тени"
    TokenType.SHAPE -> "Формы"
    TokenType.SPACING -> "Размеры"
    TokenType.FONT_FAMILY -> "Шрифты" // отфильтровано выше, вкладка никогда не показывается
    null -> "Другое"
}

@Composable
private fun TokenSearchField(query: String, onQueryChange: (String) -> Unit, modifier: Modifier = Modifier) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier,
        style = TextFieldStyles.TextFieldSDefault.style(),
        placeholderText = "Поиск токена по имени…",
    )
}

@Composable
private fun NoMatchesText() {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Ничего не найдено",
            color = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
        )
    }
}

/** Нейтральный цвет заливки для превью без собственного цвета (`shape`/`spacing`). */
private val NEUTRAL_SWATCH_COLOR = Color(0xFFB0B0B0)
private val SPACING_BAR_HEIGHT = 8.dp
private const val MAX_SPACING_PREVIEW_DP = 64f

/**
 * Превью формы — прямоугольник, у которого половина высоты больше самого большого конечного
 * `cornerRadius` в токенах (`round.xxl` = 32dp). На квадрате или невысоком прямоугольнике
 * `RoundedCornerShape` клэмпит радиус до половины короткой стороны — все значения от этого
 * порога и выше вырождаются в одинаковую полную «таблетку», неотличимую от `round.circle`
 * (9999dp). При высоте 72dp клэмп срабатывает только на 36dp — `round.xxl` (32dp) остаётся
 * видимо не до конца скруглённым прямоугольником, а `round.circle` — единственный, кто
 * действительно превращается в полную таблетку. Точное значение всё равно остаётся в подписи.
 */
private val SHAPE_PREVIEW_WIDTH = 96.dp
private val SHAPE_PREVIEW_HEIGHT = 72.dp

/**
 * `round.circle` (и любой другой сентинел такого рода) использует заведомо нереальный для
 * настоящего UI радиус (`9999dp` в сидах) только затем, чтобы форма гарантированно стала кругом
 * при любом размере элемента — показывать эту цифру как размер в dp вводит в заблуждение (это
 * не измерение, а сигнал «максимально круглая форма»).
 */
private const val SHAPE_CIRCLE_THRESHOLD_DP = 999f

/**
 * Превью тени рисуется на белой подложке независимо от темы IDE — токены теней рассчитаны на
 * полупрозрачный тёмный цвет поверх светлой поверхности и не видны на тёмном фоне. Сама
 * «приподнятая» поверхность — тёмная, для контраста с белой подложкой. Подложка обрезана по
 * своей форме (`clip`), иначе рисуемое утекает в фон строки списка снаружи подложки.
 *
 * Использует настоящий `Modifier.shadow(ShadowAppearance(layers), shape)` из `sdds-uikit-compose`
 * — тот же примитив, которым в самом `plasma-android` рисуются тени у `Popover`/`Modal`/`ToolBar`
 * (см. `BasePopover.kt`), там он прекрасно виден. Три предыдущих подхода (сам этот примитив без
 * поправок, затем `Modifier.blur`, затем ручная имитация блюра слоями) не показывали ничего —
 * тень не была сломана, недоставало **отступа** вокруг поверхности под размер тени. Реальные
 * компоненты вроде `Popover` резервируют этот отступ явно (`getShadowSafePaddings()` в
 * `ShadowUtils.kt`: `radius = spreadRadius + blurRadius`, отступ на каждую сторону —
 * `radius ∓ offset`), потому что сами по себе они — поверхности в сотни dp, где токен
 * (`blurRadius` до 112dp, `offset` до 60dp) — небольшая доля размера. У нас подложка всего 64dp
 * (`TYPE_SWATCH_SIZE`), и без такого отступа `Modifier.clip` подложки просто обрезал тень раньше,
 * чем она успевала стать видимой на глаз.
 *
 * `getShadowSafePaddings()` — `internal` в `sdds-uikit-compose`, недоступен из плагина, поэтому
 * здесь используется не сам расчёт отступа, а более простой эквивалент: `blurRadius`/`offset`
 * клэмпятся так, чтобы `spreadRadius + blurRadius + |offset|` не превышало половины свободного
 * места вокруг `SHADOW_PREVIEW_SURFACE_SIZE` внутри `TYPE_SWATCH_SIZE` — тень остаётся честной
 * (тот же рендер, что у `Popover`), просто её геометрия подрезана под доступное место, а не
 * подделана. Точные `blur`/`offset`/`spread` токена остаются в подписи текстом.
 */
private val SHADOW_PREVIEW_BACKDROP = Color.White
private val SHADOW_PREVIEW_SURFACE = Color(0xFF2C2C2C)
private val SHADOW_PREVIEW_SURFACE_SIZE = 12.dp
private const val MAX_SHADOW_BLUR_PREVIEW_DP = 16f
private const val MAX_SHADOW_OFFSET_PREVIEW_DP = 14f

@Composable
private fun TokenRow(
    item: TokenWithValue,
    resolveCodeReference: (suspend (TokenWithValue) -> TokenCodeReferenceResult)?,
) {
    val payload = item.payload
    val preview = previewContent(payload)

    ListItem(
        modifier = Modifier.fillMaxWidth(),
        style = ListItemStyles.ListItemNormalM.style(),
        text = item.token.displayName ?: item.token.name,
        subtitle = describeValue(payload, item.value?.rawValue),
        startContent = preview,
        endContent = resolveCodeReference?.let { resolve -> { CopyCodeReferenceAction(item, resolve) } },
    )
}

private enum class CopyStatus(val label: String, val style: IconButtonStyles) {
    IDLE("Копировать код", IconButtonStyles.IconButtonSSecondary),
    LOADING("Загрузка…", IconButtonStyles.IconButtonSSecondary),
    COPIED("Скопировано", IconButtonStyles.IconButtonSPositive),
    UNAVAILABLE("Нет ссылки", IconButtonStyles.IconButtonSNegative),
    FAILED("Ошибка", IconButtonStyles.IconButtonSNegative),
}

/**
 * Иконка-кнопка копирования: клик запрашивает code-ссылку токена и копирует её в буфер обмена.
 * Результат виден по цвету кнопки и короткой подписи слева от неё (в состоянии покоя подписи нет).
 */
@Composable
private fun CopyCodeReferenceAction(
    item: TokenWithValue,
    resolve: suspend (TokenWithValue) -> TokenCodeReferenceResult,
) {
    val scope = rememberCoroutineScope()
    var status by remember(item) { mutableStateOf(CopyStatus.IDLE) }
    val isError = status == CopyStatus.UNAVAILABLE || status == CopyStatus.FAILED

    Row(verticalAlignment = Alignment.CenterVertically) {
        if (status != CopyStatus.IDLE) {
            Text(
                text = status.label,
                color = if (isError) {
                    SddsServTheme.colors.textDefaultNegative
                } else {
                    SddsServTheme.colors.textDefaultSecondary
                },
                style = SddsServTheme.typography.bodyXsNormal,
            )
            Spacer(Modifier.width(SddsServTheme.spacing.spacing2x))
        }
        IconButton(
            icon = rememberVectorPainter(SddsIcons.CopyOutline24),
            onClick = {
                scope.launch {
                    status = CopyStatus.LOADING
                    status = copyCodeReference(item, resolve)
                }
            },
            style = status.style.style(),
            enabled = status != CopyStatus.LOADING,
            iconContentDescription = CopyStatus.IDLE.label,
        )
    }
}

@Suppress("TooGenericExceptionCaught")
private suspend fun copyCodeReference(
    item: TokenWithValue,
    resolve: suspend (TokenWithValue) -> TokenCodeReferenceResult,
): CopyStatus = try {
    when (val result = resolve(item)) {
        is TokenCodeReferenceResult.Found -> {
            ClipboardCopier.copy(result.reference)
            CopyStatus.COPIED
        }
        TokenCodeReferenceResult.NotAvailable -> CopyStatus.UNAVAILABLE
        is TokenCodeReferenceResult.Failed -> CopyStatus.FAILED
    }
} catch (exception: Exception) {
    CopyStatus.FAILED
}

/** Превью значения по типу — квадрат/полоска/текст-сэмпл вместо сырого JSON, где это возможно. */
private fun previewContent(payload: TokenValuePayload): (@Composable RowScope.() -> Unit)? = when (payload) {
    is TokenValuePayload.ColorValue -> { { ColorSwatch(payload.hex) } }
    is TokenValuePayload.ShapeValue -> { { ShapeSwatch(payload) } }
    is TokenValuePayload.SpacingValue -> { { SpacingBar(payload) } }
    is TokenValuePayload.GradientValue -> { { GradientSwatch(payload) } }
    is TokenValuePayload.ShadowValue -> { { ShadowSwatch(payload) } }
    is TokenValuePayload.TypographyValue -> { { TypographySample(payload) } }
    TokenValuePayload.Unsupported -> null
}

@Composable
private fun ColorSwatch(hex: String) {
    val color = parseHexColor(hex)
    Column(
        modifier = Modifier
            .size(TYPE_SWATCH_SIZE)
            .background(color ?: Color.Transparent, SWATCH_SHAPE),
    ) {}
}

@Composable
private fun ShapeSwatch(value: TokenValuePayload.ShapeValue) {
    Column(
        modifier = Modifier
            .width(SHAPE_PREVIEW_WIDTH)
            .height(SHAPE_PREVIEW_HEIGHT)
            .background(NEUTRAL_SWATCH_COLOR, RoundedCornerShape(value.cornerRadiusDp.dp)),
    ) {}
}

@Composable
private fun SpacingBar(value: TokenValuePayload.SpacingValue) {
    Column(
        modifier = Modifier
            .height(SPACING_BAR_HEIGHT)
            .width(spacingPreviewWidthDp(value.valueDp).dp)
            .background(NEUTRAL_SWATCH_COLOR, RoundedCornerShape(2.dp)),
    ) {}
}

/** Ширина полоски-превью — значение как есть, но не больше [MAX_SPACING_PREVIEW_DP] (не ломает строку списка). */
internal fun spacingPreviewWidthDp(valueDp: Float): Float = valueDp.coerceAtMost(MAX_SPACING_PREVIEW_DP)

@Composable
private fun GradientSwatch(value: TokenValuePayload.GradientValue) {
    val brush = gradientBrush(value.layers.first())
    Column(
        modifier = Modifier
            .size(TYPE_SWATCH_SIZE)
            .background(brush ?: SolidColor(Color.Transparent), SWATCH_SHAPE),
    ) {}
}

/**
 * Строит [Brush] по слою градиента через `sdds-uikit-compose` (`Gradients.Linear`/`Radial`/`Sweep`) —
 * те же примитивы, которыми реальные приложения на дизайн-системе рисуют градиенты. `radial`/`angular`
 * рендерятся приближённо: ios-поля `startRadius`/`startAngle`/`endAngle` не имеют аналога в этих
 * примитивах (см. design.md) — используется только `endRadius`/`radius`, оборот всегда полный.
 */
internal fun gradientBrush(layer: GradientLayer): Brush? = when (layer) {
    is GradientLayer.Linear -> Gradients.Linear(
        colors = layer.colors.mapNotNull(::parseHexColor),
        stops = layer.locations,
        angleInDegrees = layer.angle,
    )
    is GradientLayer.Radial -> Gradients.Radial(
        colors = layer.colors.mapNotNull(::parseHexColor),
        stops = layer.locations,
        radius = layer.radius,
        centerX = layer.centerX,
        centerY = layer.centerY,
    )
    is GradientLayer.Angular -> Gradients.Sweep(
        colors = layer.colors.mapNotNull(::parseHexColor),
        stops = layer.locations,
        centerX = layer.centerX,
        centerY = layer.centerY,
    )
    is GradientLayer.Solid -> parseHexColor(layer.hex)?.let(::SolidColor)
}

@Composable
private fun ShadowSwatch(value: TokenValuePayload.ShadowValue) {
    val layers = value.layers.map(::toPreviewShadowLayer)
    // Подложка обрезана по своей форме (clip) — у поверхности внутри есть запас места под
    // клэмпнутые blur/offset (см. KDoc у SHADOW_PREVIEW_BACKDROP), но очень большие значения
    // токена всё равно клэмпятся под этот запас, а не рисуются в реальную величину.
    Box(
        modifier = Modifier
            .size(TYPE_SWATCH_SIZE)
            .clip(SWATCH_SHAPE)
            .background(SHADOW_PREVIEW_BACKDROP, SWATCH_SHAPE),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(SHADOW_PREVIEW_SURFACE_SIZE)
                .shadow(ShadowAppearance(layers), SWATCH_SHAPE)
                .background(SHADOW_PREVIEW_SURFACE, SWATCH_SHAPE),
        )
    }
}

/** Клэмпит `blurRadius`/`offset` под запас места вокруг [SHADOW_PREVIEW_SURFACE_SIZE] — см. KDoc выше. */
private fun toPreviewShadowLayer(layer: ShadowLayerValue): ShadowLayer = ShadowLayer(
    color = parseHexColor(layer.colorHex) ?: Color.Black,
    offset = DpOffset(
        layer.offsetX.dp.coerceIn(-MAX_SHADOW_OFFSET_PREVIEW_DP.dp, MAX_SHADOW_OFFSET_PREVIEW_DP.dp),
        layer.offsetY.dp.coerceIn(-MAX_SHADOW_OFFSET_PREVIEW_DP.dp, MAX_SHADOW_OFFSET_PREVIEW_DP.dp),
    ),
    spreadRadius = layer.spreadRadius.dp,
    blurRadius = layer.blurRadius.dp.coerceAtMost(MAX_SHADOW_BLUR_PREVIEW_DP.dp),
    fallbackElevation = layer.fallbackElevation?.dp,
)

@Composable
private fun TypographySample(value: TokenValuePayload.TypographyValue) {
    Text(text = "Aa", style = typographyTextStyle(value))
}

/** Маппинг нормализованной [TokenValuePayload.TypographyValue] в Compose [TextStyle]. */
internal fun typographyTextStyle(value: TokenValuePayload.TypographyValue): TextStyle = TextStyle(
    fontSize = value.fontSizeSp.sp,
    lineHeight = value.lineHeightSp.sp,
    fontWeight = FontWeight(value.fontWeight),
    letterSpacing = value.letterSpacingEm.em,
)

/** Компактный человекочитаемый текст вместо сырого JSON; [TokenValuePayload.Unsupported] — фолбэк на [rawValue]. */
internal fun describeValue(payload: TokenValuePayload, rawValue: String?): String = when (payload) {
    is TokenValuePayload.ColorValue -> formatHexAarrggbb(payload.hex)
    is TokenValuePayload.ShapeValue -> when {
        payload.cornerRadiusDp >= SHAPE_CIRCLE_THRESHOLD_DP -> "circle"
        else -> "${payload.cornerRadiusDp.formatCompact()}dp"
    }
    is TokenValuePayload.SpacingValue -> "${payload.valueDp.formatCompact()}dp"
    is TokenValuePayload.GradientValue -> payload.layers.joinToString(", ") { it.describe() }
    is TokenValuePayload.ShadowValue -> describeShadow(payload.layers)
    is TokenValuePayload.TypographyValue ->
        "${payload.fontSizeSp.formatCompact()}sp / ${payload.lineHeightSp.formatCompact()}sp, ${payload.fontWeight}"
    // rawValue пустой, если значение опубликовано, но само поле value в БД равно null
    // (реальный случай — см. outline.default.accent) — показываем так же, как отсутствующее.
    TokenValuePayload.Unsupported -> rawValue?.ifBlank { null } ?: "—"
}

private fun GradientLayer.describe(): String = when (this) {
    is GradientLayer.Linear -> "linear, ${angle.formatCompact()}°"
    is GradientLayer.Radial -> "radial"
    is GradientLayer.Angular -> "angular"
    is GradientLayer.Solid -> formatHexAarrggbb(hex)
}

private fun describeShadow(layers: List<ShadowLayerValue>): String {
    val first = layers.first()
    val extra = if (layers.size > 1) " +${layers.size - 1}" else ""
    return "blur ${first.blurRadius.formatCompact()}dp, offset ${first.offsetY.formatCompact()}dp$extra"
}

/** `12.0` → `"12"`, `-0.02` → `"-0.02"` — без лишнего `.0` для целых значений. */
private fun Float.formatCompact(): String =
    if (this == this.toInt().toFloat()) this.toInt().toString() else this.toString()

/** Разбирает `#RRGGBB`/`#RRGGBBAA` (прозрачность в конце, как во всей теме) из raw JSON-текста значения. `null`, если это не hex-цвет. */
internal fun parseHexColor(rawValue: String?): Color? {
    val hex = rawValue?.trim()?.trim('"')?.removePrefix("#") ?: return null

    return try {
        when (hex.length) {
            6 -> Color(
                red = hex.substring(0, 2).toInt(16),
                green = hex.substring(2, 4).toInt(16),
                blue = hex.substring(4, 6).toInt(16),
            )
            8 -> Color(
                red = hex.substring(0, 2).toInt(16),
                green = hex.substring(2, 4).toInt(16),
                blue = hex.substring(4, 6).toInt(16),
                alpha = hex.substring(6, 8).toInt(16),
            )
            else -> null
        }
    } catch (exception: NumberFormatException) {
        null
    }
}
