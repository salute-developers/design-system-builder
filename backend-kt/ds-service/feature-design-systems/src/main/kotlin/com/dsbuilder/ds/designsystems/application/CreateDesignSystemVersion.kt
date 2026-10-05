package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.PublicationStatus

/** Validated input for a design-system version. */
data class CreateDesignSystemVersion(
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
)
