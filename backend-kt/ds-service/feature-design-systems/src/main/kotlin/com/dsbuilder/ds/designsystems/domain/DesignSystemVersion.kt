package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Immutable design-system snapshot version. */
data class DesignSystemVersion(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: DesignSystemId,
    /** Version carried by this contract. */
    val version: String,
    /** Snapshot json carried by this contract. */
    val snapshotJson: String,
    /** Changelog carried by this contract. */
    val changelog: String?,
    /** Publication status carried by this contract. */
    val publicationStatus: PublicationStatus?,
    /** Published at carried by this contract. */
    val publishedAt: Instant,
)
