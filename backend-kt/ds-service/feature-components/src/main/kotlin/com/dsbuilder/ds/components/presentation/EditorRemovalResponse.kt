package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.EditorRemoval
import kotlinx.serialization.Serializable

/** Итог удаления оси или значения оси. */
@Serializable
data class EditorRemovalResponse(
    /** Число удалённых зависимых значений. */
    val removedDependents: Int,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: EditorRemoval) = EditorRemovalResponse(value.removedDependents)
    }
}
