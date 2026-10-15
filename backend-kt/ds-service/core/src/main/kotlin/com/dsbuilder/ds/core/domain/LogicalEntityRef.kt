package com.dsbuilder.ds.core.domain

import java.util.UUID

/** Ссылка на логическую сущность, имеющую независимую техническую редакцию. */
data class LogicalEntityRef(
    /** Устойчивый тип предметной сущности. */
    val type: String,
    /** Идентификатор устойчивой строки сущности. */
    val id: UUID,
) : Comparable<LogicalEntityRef> {
    init {
        require(type.matches(ENTITY_TYPE_PATTERN)) { "Invalid logical entity type" }
    }

    override fun compareTo(other: LogicalEntityRef): Int = compareValuesBy(this, other, { it.type }, { it.id })

    private companion object {
        val ENTITY_TYPE_PATTERN = Regex("[a-z][a-z0-9-]{0,63}")
    }
}
