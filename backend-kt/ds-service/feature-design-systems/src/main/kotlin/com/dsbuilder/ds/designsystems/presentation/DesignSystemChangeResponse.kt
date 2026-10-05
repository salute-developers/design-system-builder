package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemChange
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** External design-system change representation. */
@Serializable
data class DesignSystemChangeResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Entity type carried by this contract. */
    val entityType: String,
    /** Entity id carried by this contract. */
    val entityId: String,
    /** Operation carried by this contract. */
    val operation: String,
    /** Data carried by this contract. */
    val data: JsonElement?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemChange) = DesignSystemChangeResponse(
            value.id.toString(),
            value.designSystemId.value.toString(),
            value.entityType,
            value.entityId.toString(),
            value.operation.wireValue,
            value.dataJson?.let(Json::parseToJsonElement),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
