package com.dsbuilder.projects.feature.projects.data.local

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import io.ktor.server.config.ApplicationConfig
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.milliseconds

internal data class AccessKeyConfiguration(
    val keyPrefix: String,
    val defaultTtl: Duration,
    val secretByteLength: Int,
    val availableScopes: Set<AccessKeyScope>,
    val hashing: AccessKeyHashingConfiguration,
)

internal data class AccessKeyHashingConfiguration(
    val iterations: Int,
    val keyLengthBits: Int,
    val saltByteLength: Int,
)

internal fun ApplicationConfig.accessKeyConfiguration(evaluator: PolicyEvaluator): AccessKeyConfiguration {
    val scopes = evaluator.projectKeyScopes().mapNotNull(AccessKeyScope::parse).toSet()
    if (scopes.isEmpty()) {
        throw InvalidProjectRequestException("Canonical project-key scope catalog must not be empty")
    }

    return AccessKeyConfiguration(
        keyPrefix = propertyOrNull("projects.accessKeys.keyPrefix")?.getString()?.trim().orEmpty().ifBlank {
            "dsb_pk"
        },
        defaultTtl = (
            propertyOrNull("projects.accessKeys.defaultTtlMs")?.getString()?.toLong()
                ?: 30.days.inWholeMilliseconds
            ).milliseconds,
        secretByteLength = propertyOrNull("projects.accessKeys.secretByteLength")?.getString()?.toInt() ?: 32,
        availableScopes = scopes,
        hashing = AccessKeyHashingConfiguration(
            iterations =
            propertyOrNull("projects.accessKeys.hashing.iterations")?.getString()?.toInt() ?: 120_000,
            keyLengthBits =
            propertyOrNull("projects.accessKeys.hashing.keyLengthBits")?.getString()?.toInt() ?: 256,
            saltByteLength =
            propertyOrNull("projects.accessKeys.hashing.saltByteLength")?.getString()?.toInt() ?: 16,
        ),
    )
}
