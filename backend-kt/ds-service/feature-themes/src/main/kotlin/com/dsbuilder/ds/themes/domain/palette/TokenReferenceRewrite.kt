package com.dsbuilder.ds.themes.domain.palette

/** Переписывание ссылок токенов группы при удалении растяжки. */
data class TokenReferenceRewrite(
    /** Токены, ссылки которых переписываются. */
    val tokenIds: List<String>,
    /** Убираемый слот. */
    val from: PaletteRampRef,
    /** Растяжка замены или `null` — значения становятся HEX. */
    val to: PaletteRampRef?,
) {
    /**
     * Новое значение ссылки: та же ступень замены или вычисленный HEX с прозрачностью; `null`, если ссылка не
     * указывает на убираемый слот или HEX не вычислить.
     */
    fun rewrite(reference: PaletteReference, resolveHex: (Int) -> String?): String? = when {
        reference.ramp != from -> null
        to != null -> reference.copy(ramp = to).format()
        else -> resolveHex(reference.step)?.let { PaletteColors.withOpacity(it, reference.opacity) }
    }
}
