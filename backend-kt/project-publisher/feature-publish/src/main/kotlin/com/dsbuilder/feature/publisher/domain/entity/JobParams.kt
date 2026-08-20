package com.dsbuilder.feature.publisher.domain.entity

import java.util.UUID

data class JobParams(
    val projectId: UUID,
    val target: JobTarget,
    val name: String,
    val version: JobProjectVersion,
    val description: String? = null,
    // TODO projectKey - костыль для разработки, убрать как появится API проектов
    val projectKey: String? = null,
)

data class JobProjectVersion(
    val major: Int,
    val minor: Int,
    val patch: Int,
    val name: String? = null
) {
    override fun toString(): String {
        return "$major.$minor.$patch"
    }
}