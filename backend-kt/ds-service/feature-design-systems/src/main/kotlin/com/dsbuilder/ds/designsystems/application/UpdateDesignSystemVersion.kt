package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.PublicationStatus

/** Validated partial version update. */
data class UpdateDesignSystemVersion(
    /** Changelog carried by this contract. */
    val changelog: String?,
    /** Changelog present carried by this contract. */
    val changelogPresent: Boolean,
    /** Publication status carried by this contract. */
    val publicationStatus: PublicationStatus?,
    /** Publication status present carried by this contract. */
    val publicationStatusPresent: Boolean,
)
