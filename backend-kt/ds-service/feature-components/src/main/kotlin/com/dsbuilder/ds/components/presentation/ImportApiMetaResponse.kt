package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import kotlinx.serialization.Serializable

/** HTTP report returned by the API-meta import and its dry run. */
@Serializable
data class ImportApiMetaResponse(
    /** Components created. */
    val createdComponents: Int,
    /** Properties created. */
    val createdProperties: Int,
    /** States created. */
    val createdStates: Int,
    /** Platform names created. */
    val createdAliases: Int,
    /** Properties already stored with the same type. */
    val unchangedProperties: Int,
    /** Platform names that became deprecated. */
    val deprecatedMarked: Int,
    /** Deprecated platform names whose message changed. */
    val deprecatedMessageChanged: Int,
    /** Platform names whose deprecation was cleared. */
    val deprecatedCleared: Int,
    /** Properties that were not written. */
    val rejected: List<Rejection>,
    /** Existing properties whose stored type differs from the meta. */
    val typeMismatches: List<String>,
    /** Stored for the platform but absent from the meta; informational. */
    val absent: List<String>,
) {
    /** One property that was not written. */
    @Serializable
    data class Rejection(
        /** Component name. */
        val component: String,
        /** Property name. */
        val property: String,
        /** Stable reason. */
        val reason: String,
    )

    companion object {
        /** Performs the from operation. */
        fun from(value: ApiMetaImportReport) = ImportApiMetaResponse(
            value.createdComponents,
            value.createdProperties,
            value.createdStates,
            value.createdAliases,
            value.unchangedProperties,
            value.deprecatedMarked,
            value.deprecatedMessageChanged,
            value.deprecatedCleared,
            value.rejected.map { Rejection(it.component, it.property, it.reason) },
            value.typeMismatches,
            value.absent,
        )
    }
}
