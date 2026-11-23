package com.dsbuilder.ds.components.domain

/** Только доказуемые ограничения значений; неизвестный enum не превращается в конфликт. */
internal object CoreValueCompatibility {
    private val numeric = setOf("dimension", "float", "integer", "value")
    private val fractional = setOf("dimension", "float")
    private val paints = setOf("color", "gradient")

    private val tokenTypes = numeric.associateWith { numeric } + paints.associateWith { paints } +
        ("dimension" to numeric + "spacing")

    /** Неизвестный тип токена не доказывает конфликт; известные типы проверяются по семейству свойства. */
    fun tokenFits(property: String, token: String?): Boolean =
        token == null || token in tokenTypes.getOrDefault(property, setOf(property))

    /** Проверка литерала без догадок о неописанных платформенных ограничениях. */
    fun literalFits(property: String, literal: String?, platform: String): Boolean = when {
        literal == null -> true
        // Web numeric properties also accept CSS keywords, units and expressions (auto, calc, var).
        platform == "web" && property in numeric -> true
        property == "boolean" -> literal in setOf("true", "false")
        property == "integer" -> literal.toLongOrNull() != null
        property in fractional -> literal.toDoubleOrNull()?.isFinite() == true
        else -> true
    }
}
