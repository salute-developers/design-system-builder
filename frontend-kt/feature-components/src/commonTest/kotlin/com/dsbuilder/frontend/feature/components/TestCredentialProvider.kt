package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.ProjectApiUrl

internal fun testCredentialProvider(result: CredentialResult): CredentialProvider = object : CredentialProvider {
    override suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
    ): CredentialResult = result
}
