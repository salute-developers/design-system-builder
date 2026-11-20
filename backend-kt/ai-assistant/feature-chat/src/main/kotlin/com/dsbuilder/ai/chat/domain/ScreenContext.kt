package com.dsbuilder.ai.chat.domain

/**
 * Что открыто в редакторе на момент сообщения. Подсказка для модели, а не право: каждый вызов инструмента по-прежнему
 * проверяет use case.
 *
 * @property section раздел редактора темы.
 * @property tenantId открытая тема.
 * @property token выбранный токен на страницах цветов, типографики и размеров.
 * @property component открытый компонент.
 */
data class ScreenContext(
    val section: String,
    val tenantId: String? = null,
    val token: ScreenToken? = null,
    val component: ScreenComponent? = null,
) {
    companion object {
        /** Разделы редактора, которые принимает сервер. */
        val SECTIONS = setOf("colors", "typography", "shapes", "palette", "components", "other")

        /** Предел длины имени в контексте. */
        const val MAX_NAME_LENGTH = 200

        /** Предел числа выбранных значений вариаций. */
        const val MAX_SELECTED_VALUES = 20

        /** Предел длины имени вариации и её значения. */
        const val MAX_VALUE_NAME_LENGTH = 64

        /** Допустимое имя: буквы, цифры, пробел и `._-/`; так имя не может выйти за пределы блока в промпте. */
        val NAME = Regex("^[\\p{L}\\p{N} ._/-]{1,$MAX_NAME_LENGTH}$")
    }
}

/**
 * Выбранный токен.
 *
 * @property id идентификатор определения токена.
 * @property name имя токена.
 */
data class ScreenToken(val id: String, val name: String? = null)

/**
 * Открытый компонент.
 *
 * @property name имя компонента; имя, не прошедшее проверку, отбрасывается.
 * @property id идентификатор компонента.
 * @property appearanceId открытая конфигурация.
 * @property selectedValues значения вариаций, выбранные в превью.
 */
data class ScreenComponent(
    val name: String? = null,
    val id: String? = null,
    val appearanceId: String? = null,
    val selectedValues: List<ScreenVariationValue> = emptyList(),
)

/**
 * Значение вариации, выбранное в превью.
 *
 * @property variation имя вариации.
 * @property value имя значения.
 * @property styleId `styleId` значения для поля `styleIds` инструментов записи.
 */
data class ScreenVariationValue(val variation: String?, val value: String?, val styleId: String)
