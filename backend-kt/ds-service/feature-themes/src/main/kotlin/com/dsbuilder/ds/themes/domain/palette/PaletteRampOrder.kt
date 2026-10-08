package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType

/** Порядок растяжек: сначала `general`, затем `additional`, внутри типа — естественный порядок оттенка. */
object PaletteRampOrder : Comparator<PaletteRampRef> {
    private val chunk = Regex("\\d+|\\D+")

    override fun compare(first: PaletteRampRef, second: PaletteRampRef): Int = when {
        first.type != second.type -> if (first.type == ThemePaletteType.GENERAL) -1 else 1
        else -> natural(first.shade, second.shade)
    }

    /** Естественное сравнение, как `localeCompare(…, { numeric: true })`: `h2` < `h10`, регистр — вторичен. */
    fun natural(first: String, second: String): Int {
        val left = chunk.findAll(first).map { it.value }.toList()
        val right = chunk.findAll(second).map { it.value }.toList()
        for (index in 0 until minOf(left.size, right.size)) {
            val result = compareChunks(left[index], right[index])
            if (result != 0) return result
        }
        return (left.size - right.size).takeIf { it != 0 } ?: first.compareTo(second)
    }

    private fun compareChunks(left: String, right: String): Int {
        val leftNumber = left.toBigIntegerOrNull()
        val rightNumber = right.toBigIntegerOrNull()
        return if (leftNumber != null && rightNumber != null) {
            leftNumber.compareTo(rightNumber)
        } else {
            left.lowercase().compareTo(right.lowercase())
        }
    }
}
