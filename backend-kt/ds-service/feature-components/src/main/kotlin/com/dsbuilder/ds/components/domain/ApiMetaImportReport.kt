package com.dsbuilder.ds.components.domain

/** Report produced by an additive API-meta import into the global component layer. */
data class ApiMetaImportReport(
    /** Components created for the requested platform. */
    val createdComponents: Int = 0,
    /** Properties created. */
    val createdProperties: Int = 0,
    /** Component states created. */
    val createdStates: Int = 0,
    /** Platform names created. */
    val createdAliases: Int = 0,
    /** Properties already present with the same type. */
    val unchangedProperties: Int = 0,
    /** Platform names that became deprecated, including those created already deprecated. */
    val deprecatedMarked: Int = 0,
    /** Deprecated platform names whose message changed. */
    val deprecatedMessageChanged: Int = 0,
    /** Platform names whose deprecation was cleared because the meta no longer carries it. */
    val deprecatedCleared: Int = 0,
    /** Properties that could not be written; the rest of the import does not depend on them. */
    val rejected: List<Rejection> = emptyList(),
    /** Existing properties whose stored type differs from the meta; the type is never changed. */
    val typeMismatches: List<String> = emptyList(),
    /** Informational: stored for the platform but absent from the meta; nothing is removed. */
    val absent: List<String> = emptyList(),
) {
    /** One property that was not written. */
    data class Rejection(
        /** Component name. */
        val component: String,
        /** Property name. */
        val property: String,
        /** Stable reason. */
        val reason: String,
    )
}
