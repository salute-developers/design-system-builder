package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** External design-system version representation. */
@Serializable
data class DesignSystemVersionResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Version carried by this contract. */
    val version: String,
    /** Snapshot carried by this contract. */
    val snapshot: JsonElement,
    /** Changelog carried by this contract. */
    val changelog: String?,
    /** Publication status carried by this contract. */
    val publicationStatus: String?,
    /** Published at carried by this contract. */
    val publishedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemVersion) = DesignSystemVersionResponse(
            value.id.toString(),
            value.designSystemId.value.toString(),
            value.version,
            Json.parseToJsonElement(value.snapshotJson),
            value.changelog,
            value.publicationStatus?.wireValue,
            value.publishedAt.toString(),
        )
    }
}
