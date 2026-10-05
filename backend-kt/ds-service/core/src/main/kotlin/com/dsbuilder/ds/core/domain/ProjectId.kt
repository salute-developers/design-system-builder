package com.dsbuilder.ds.core.domain

/** Stable project boundary supplied by the trusted gateway through [value]. */
@JvmInline
value class ProjectId(val value: String) {
    init {
        require(value.isNotBlank()) { "Project id must not be blank" }
    }
}
