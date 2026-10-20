package com.dsbuilder.ds.core.application

import java.util.UUID

/** Группа и порядок исходного определения. */
data class InitialTokenPlacement(
    /** Идентификатор созданной группы. */
    val groupId: UUID,
    /** Позиция определения внутри группы. */
    val position: Int,
)
