package com.dsbuilder.ds.themes.domain.typography

/** Начертание стиля типографии: стиль состоит из трёх токенов, которые отличаются весом. */
enum class TypographyVariant(
    /** Последний сегмент имени токена. */
    val wireValue: String,
) {
    /** Обычное начертание. */
    NORMAL("normal"),

    /** Среднее начертание. */
    MEDIUM("medium"),

    /** Жирное начертание. */
    BOLD("bold"),
    ;

    companion object {
        /** Начертание по последнему сегменту имени токена. */
        fun fromWire(value: String?): TypographyVariant? = entries.firstOrNull { it.wireValue == value }
    }
}
