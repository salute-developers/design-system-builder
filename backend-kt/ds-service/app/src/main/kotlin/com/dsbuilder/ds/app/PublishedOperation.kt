package com.dsbuilder.ds.app

/** One bounded route label from the reviewed manifest. */
data class PublishedOperation(
    /** HTTP method. */
    val method: String,
    /** Internal route template. */
    val path: String,
    /** Required authorization permission. */
    val permission: String,
)
