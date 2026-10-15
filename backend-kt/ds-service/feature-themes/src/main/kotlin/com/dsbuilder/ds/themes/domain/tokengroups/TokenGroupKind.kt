package com.dsbuilder.ds.themes.domain.tokengroups

/** Вид токенов дерева групп; `color` — цветовые и градиентные токены. */
enum class TokenGroupKind(
    /** Строковое значение PostgreSQL enum `token_group_kind`. */
    val wireValue: String,
) {
    COLOR("color"),
    ;

    companion object {
        /** Вид по строковому контракту. */
        fun fromWire(value: String?): TokenGroupKind? = entries.firstOrNull { it.wireValue == value }
    }
}
