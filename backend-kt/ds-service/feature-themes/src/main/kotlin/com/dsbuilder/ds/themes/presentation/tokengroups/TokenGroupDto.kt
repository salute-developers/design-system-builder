package com.dsbuilder.ds.themes.presentation.tokengroups

import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import kotlinx.serialization.Serializable

/** Группа или подгруппа токенов. */
@Serializable
data class TokenGroupDto(
    /** Идентификатор. */
    val id: String,
    /** Группа подгруппы или `null` у группы. */
    val parentId: String?,
    /** Код группы — первый сегмент имени её токенов; у подгруппы `null`. */
    val code: String?,
    /** Название. */
    val label: String,
    /** Позиция среди соседей. */
    val position: Int,
    /** Вид токенов. */
    val kind: String,
    /** Базовая предметная редакция для следующего изменения этой группы. */
    val editRevision: Long = 0,
) {
    companion object {
        /** DTO узла. */
        fun from(group: TokenGroup) = TokenGroupDto(
            id = group.id.toString(),
            parentId = group.parentId?.toString(),
            code = group.code,
            label = group.label,
            position = group.position,
            kind = group.kind.wireValue,
            editRevision = group.editRevision,
        )
    }
}
