package com.dsbuilder.ds.tokens.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** Minimal design-system projection used for ownership joins. */
internal object TokenDesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val projectId = text("project_id").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object TokenVersionBoundariesTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val status = postgresEnum(
        "status",
        "design_system_version_status",
        TokenVersionBoundaryStatus::fromWire,
        TokenVersionBoundaryStatus::wireValue,
    )
    val sequenceNumber = long("sequence_number")
    val createdAt = timestamp("created_at")
}

internal enum class TokenVersionBoundaryStatus(val wireValue: String) {
    BASELINE("baseline"),
    DRAFT("draft"),
    PUBLISHED("published"),
    ;

    companion object {
        fun fromWire(value: String): TokenVersionBoundaryStatus? = entries.firstOrNull { it.wireValue == value }
    }
}

/** Minimal tenant projection used to keep token values inside one design system. */
internal object TokenTenantsTable : Table("tenants") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", TokenDesignSystemsTable.id)
    override val primaryKey = PrimaryKey(id)
}

/** Minimal tenant revision projection used to exclude values of deleted tenants. */
internal object TokenTenantRevisionsTable : Table("tenant_revisions") {
    val tenantId = reference("tenant_id", TokenTenantsTable.id)
    val designSystemId = uuid("design_system_id")
    val versionSequenceNumber = long("version_sequence_number")
    val deleted = bool("deleted")
}
