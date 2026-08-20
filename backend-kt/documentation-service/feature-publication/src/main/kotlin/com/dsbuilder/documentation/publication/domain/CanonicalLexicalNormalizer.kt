package com.dsbuilder.documentation.publication.domain

import java.text.Normalizer
import java.util.Locale

/** Канонические exact и token representations lexical query или lookup term. */
data class CanonicalLexicalText(
    /** Unicode-normalized literal representation со значимой пунктуацией. */
    val exact: String,
    /** Детерминированные searchable tokens. */
    val tokens: List<String>,
) {
    /** Token representation для FTS и prefix lookup. */
    val tokenText: String = tokens.joinToString(" ")
}

/** Единая versioned Unicode-aware нормализация query и technical terms. */
object CanonicalLexicalNormalizer {
    /** Версия contract, меняемая только вместе с regression corpus. */
    const val VERSION: String = "lexical-v1"

    /**
     * Строит literal exact representation и токены для CamelCase, qualified, kebab-case и snake_case.
     * Возвращает `null`, когда после нормализации нет букв или цифр.
     */
    fun normalize(value: String): CanonicalLexicalText? {
        val unicode = Normalizer.normalize(value, Normalizer.Form.NFKC)
        val spaced = unicode.trim().replace(WHITESPACE, " ")
        val exact = spaced.lowercase(Locale.ROOT)
        if (exact.none(Char::isLetterOrDigit)) return null
        val camelSplit = spaced.replace(CAMEL_BOUNDARY, "$1 $2")
        val tokens = camelSplit
            .replace(TECHNICAL_SEPARATORS, " ")
            .replace(NON_SEARCHABLE, " ")
            .lowercase(Locale.ROOT)
            .split(WHITESPACE)
            .filter(String::isNotBlank)
        return CanonicalLexicalText(exact, tokens)
    }
}

private val WHITESPACE = Regex("\\s+")
private val CAMEL_BOUNDARY = Regex("([\\p{Ll}\\d])([\\p{Lu}])")
private val TECHNICAL_SEPARATORS = Regex("[.\\-_: @?]+")
private val NON_SEARCHABLE = Regex("[^\\p{L}\\p{N}]+")
