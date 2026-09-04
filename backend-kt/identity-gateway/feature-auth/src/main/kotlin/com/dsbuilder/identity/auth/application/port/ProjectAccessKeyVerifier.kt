package com.dsbuilder.identity.auth.application.port

internal interface ProjectAccessKeyVerifier {
    suspend fun verify(token: String): ProjectAccessKeyVerificationResult
}

internal sealed interface ProjectAccessKeyVerificationResult {
    data class Valid(
        val keyId: String,
        val projectId: String,
        val scopes: Set<String>,
    ) : ProjectAccessKeyVerificationResult

    data object Invalid : ProjectAccessKeyVerificationResult

    data object Unavailable : ProjectAccessKeyVerificationResult
}
