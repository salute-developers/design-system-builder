package com.dsbuilder.ds.themes.domain.tokengroups

import com.dsbuilder.ds.themes.domain.colortokens.TokenNameRule

/** Правила названия и кода группы токенов. */
object TokenGroupRules {
    private const val MAX_LABEL = 80
    private val NOT_CODE = Regex("[^a-z0-9]+")

    /** Причина отказа для названия [value] или `null`, если название допустимо. */
    fun label(value: String): String? = when {
        value.isBlank() -> "Название группы не может быть пустым"
        value.trim().length > MAX_LABEL -> "Название группы длиннее $MAX_LABEL символов"
        else -> null
    }

    /** Код группы из названия: латиница в нижнем регистре и цифры через дефис; `null`, если их нет. */
    fun codeFromLabel(label: String): String? =
        label.lowercase().replace(NOT_CODE, "-").trim('-').takeIf(TokenNameRule::validSegment)

    /** Совпадают ли названия без учёта регистра и пробелов по краям. */
    fun sameLabel(left: String, right: String): Boolean = left.trim().equals(right.trim(), ignoreCase = true)
}
