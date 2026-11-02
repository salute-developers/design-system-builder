package com.dsbuilder.app.data

import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import kotlinx.coroutines.CancellationException

/** Сохраняет проверку срока, отзыва и областей доступа существующего сценария. */
class InProcessProjectKey(private val projects: ProjectAuthorization) : ProjectAccessKeyVerifier {
    override suspend fun verify(token: String): ProjectAccessKeyVerificationResult = try {
        val key = projects.verify(token)
        if (key == null) {
            ProjectAccessKeyVerificationResult.Invalid
        } else {
            ProjectAccessKeyVerificationResult.Valid(key.keyId, key.projectId, key.scopes)
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        ProjectAccessKeyVerificationResult.Unavailable
    }
}
