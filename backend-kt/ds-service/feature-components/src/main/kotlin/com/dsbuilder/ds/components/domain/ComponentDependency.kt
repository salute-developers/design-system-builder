package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Directed component relation used for reuse and composition. */
data class ComponentDependency(
    /** Id carried by this contract. */
    val id: UUID,
    /** Parent id carried by this contract. */
    val parentId: UUID,
    /** Child id carried by this contract. */
    val childId: UUID,
    /** Type carried by this contract. */
    val type: RelationType,
    /** Order carried by this contract. */
    val order: Int?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
) {
    /** Relation type persisted by db-service. */
    enum class RelationType(/** Wire value carried by this contract. */ val wireValue: String) {
        REUSE("reuse"),
        COMPOSE("compose"),
        ;

        companion object {
            /** Performs the from wire operation. */
            fun fromWire(value: String): RelationType? = entries.find { it.wireValue == value }
        }
    }
}
