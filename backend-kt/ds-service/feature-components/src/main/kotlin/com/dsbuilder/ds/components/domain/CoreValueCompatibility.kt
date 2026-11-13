package com.dsbuilder.ds.components.domain

/** Только доказуемые ограничения значений; неизвестный enum не превращается в конфликт. */
internal object CoreValueCompatibility {
    private val numeric = setOf("dimension", "float", "integer", "value")
    private val paints = setOf("color", "gradient")

    /** Совместимость типа токена с API свойства. */
    fun tokenFits(property: String, token: String): Boolean = property == token ||
        (property in numeric && token in numeric) || (property in paints && token in paints)

    /** Проверка литерала без догадок о неописанных платформенных ограничениях. */
    fun literalFits(property: String, literal: String?, platform: String): Boolean = when {
        literal == null -> true
        // Web numeric properties also accept CSS keywords, units and expressions (auto, calc, var).
        platform == "web" && property in numeric -> true
        property == "boolean" -> literal in setOf("true", "false")
        property == "integer" -> literal.toLongOrNull() != null
        property in numeric && property != "value" -> literal.toDoubleOrNull()?.isFinite() == true
        else -> true
    }
}
