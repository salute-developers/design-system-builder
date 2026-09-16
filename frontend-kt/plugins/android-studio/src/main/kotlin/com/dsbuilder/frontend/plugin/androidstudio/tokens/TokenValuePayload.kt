package com.dsbuilder.frontend.plugin.androidstudio.tokens

/**
 * Распарсенное значение токена, типизированное под [TokenType]. Домен не зависит от Compose —
 * преобразование в конкретные Compose-примитивы (`Color`, `Shape`, `Brush`, `TextStyle`) остаётся
 * на стороне UI (`ui` пакет).
 *
 * Разбор рассчитан на платформы `android`/`ios` — их JSON-формы для [ShapeValue]/[SpacingValue]/
 * [GradientValue]/[ShadowValue] совпадают структурно, а для [TypographyValue] сводятся к одной
 * нормализованной модели, несмотря на разные имена полей в исходном JSON. Значение платформы
 * `web` (CSS-строки) и любая форма, не соответствующая ожидаемой для типа токена, дают
 * [Unsupported] — вызывающий код в этом случае показывает [TokenValue.rawValue] как текст.
 */
public sealed interface TokenValuePayload {

    /**
     * `color`: цвет как hex-строка, как есть из значения токена.
     *
     * @property hex `#RRGGBB`/`#AARRGGBB`.
     */
    public data class ColorValue(
        public val hex: String,
    ) : TokenValuePayload

    /**
     * `shape`: скруглённая форма. `kind`, отличный от `round`, не порождает [ShapeValue] — см. [Unsupported].
     *
     * @property cornerRadiusDp радиус скругления в dp.
     */
    public data class ShapeValue(
        public val cornerRadiusDp: Float,
    ) : TokenValuePayload

    /**
     * `spacing`: размер.
     *
     * @property valueDp значение в dp.
     */
    public data class SpacingValue(
        public val valueDp: Float,
    ) : TokenValuePayload

    /**
     * `gradient`.
     *
     * @property layers один или несколько слоёв, каждый своего вида — см. [GradientLayer].
     */
    public data class GradientValue(
        public val layers: List<GradientLayer>,
    ) : TokenValuePayload

    /**
     * `shadow`.
     *
     * @property layers один или несколько слоёв тени — см. [ShadowLayerValue].
     */
    public data class ShadowValue(
        public val layers: List<ShadowLayerValue>,
    ) : TokenValuePayload

    /**
     * `typography`: нормализованное представление, общее для android/ios, несмотря на разные
     * имена полей в исходном JSON (android: `fontWeight`/`textSize`/`letterSpacing`; ios:
     * `weight`/`size`/`kerning`).
     *
     * @property fontFamilyRef имя референса на токен `fontFamily` (не резолвится в файл шрифта).
     * @property fontSizeSp размер шрифта в sp (android `textSize`/ios `size`).
     * @property lineHeightSp межстрочный интервал в sp.
     * @property fontWeight числовой вес начертания (`100`..`900`); для ios приводится из
     *   строкового enum по таблице в парсере.
     * @property fontStyle `normal`/`italic`, как в исходном значении.
     * @property letterSpacingEm трекинг в той же шкале, что и исходное значение (android
     *   `letterSpacing`/ios `kerning` уже в одних единицах — отдельного пересчёта не требуется).
     */
    public data class TypographyValue(
        public val fontFamilyRef: String,
        public val fontSizeSp: Float,
        public val lineHeightSp: Float,
        public val fontWeight: Int,
        public val fontStyle: String,
        public val letterSpacingEm: Float,
    ) : TokenValuePayload

    /**
     * Значение не удалось разобрать в типизированную форму — платформа `web`, неизвестный `kind`
     * или форма, не совпадающая с ожидаемой для типа токена. Показывается как [TokenValue.rawValue].
     */
    public data object Unsupported : TokenValuePayload
}

/** Один слой градиента. `kind` в исходном JSON определяет, какой из вариантов это. */
public sealed interface GradientLayer {

    /**
     * `kind: "linear"` — линейный градиент под углом [angle].
     *
     * @property colors цвета остановок, hex-строками.
     * @property locations позиции остановок (`0`..`1`), по одной на каждый цвет.
     * @property angle угол в градусах.
     */
    public data class Linear(
        public val colors: List<String>,
        public val locations: List<Float>,
        public val angle: Float,
    ) : GradientLayer

    /**
     * `kind: "radial"`. У android есть только [radius]; у ios — `startRadius`/`endRadius`,
     * из которых сюда попадает `endRadius` (см. design.md, `startRadius` аналога не имеет).
     *
     * @property colors цвета остановок, hex-строками.
     * @property locations позиции остановок (`0`..`1`), по одной на каждый цвет.
     * @property radius радиус градиента.
     * @property centerX смещение центра по X (`0`..`1`).
     * @property centerY смещение центра по Y (`0`..`1`).
     */
    public data class Radial(
        public val colors: List<String>,
        public val locations: List<Float>,
        public val radius: Float,
        public val centerX: Float,
        public val centerY: Float,
    ) : GradientLayer

    /**
     * `kind: "angular"`. Ios-поля `startAngle`/`endAngle` не имеют аналога в рендере (полный
     * оборот) и здесь не хранятся — см. design.md.
     *
     * @property colors цвета остановок, hex-строками.
     * @property locations позиции остановок (`0`..`1`), по одной на каждый цвет.
     * @property centerX смещение центра по X (`0`..`1`).
     * @property centerY смещение центра по Y (`0`..`1`).
     */
    public data class Angular(
        public val colors: List<String>,
        public val locations: List<Float>,
        public val centerX: Float,
        public val centerY: Float,
    ) : GradientLayer

    /**
     * `kind: "color"` — не градиент, а сплошная заливка.
     *
     * @property hex цвет заливки.
     */
    public data class Solid(
        public val hex: String,
    ) : GradientLayer
}

/**
 * Один слой тени.
 *
 * @property colorHex цвет тени.
 * @property offsetX смещение по оси X, в dp.
 * @property offsetY смещение по оси Y, в dp.
 * @property spreadRadius радиус распространения, в dp.
 * @property blurRadius радиус размытия, в dp.
 * @property fallbackElevation значение elevation для API < 28; `null`, если не задано.
 */
public data class ShadowLayerValue(
    public val colorHex: String,
    public val offsetX: Float,
    public val offsetY: Float,
    public val spreadRadius: Float,
    public val blurRadius: Float,
    public val fallbackElevation: Float?,
)
