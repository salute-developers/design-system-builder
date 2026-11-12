package com.dsbuilder.ds.core.application

import java.util.UUID

/** Состав и фактический производный тип семейства после предполагаемого отката. */
data class LiteralValueFamilyState(
    /** Определения семейства под блокировками. */
    val tokenIds: Set<UUID>,
    /** Типы определений до отката. */
    val storedTypes: Set<String>,
    /** Производный тип после предполагаемого отката. */
    val restoredType: String,
) {
    /** Семейство не требует мутации определений после восстановления значений. */
    fun unchanged(): Boolean = storedTypes == setOf(restoredType)
}
