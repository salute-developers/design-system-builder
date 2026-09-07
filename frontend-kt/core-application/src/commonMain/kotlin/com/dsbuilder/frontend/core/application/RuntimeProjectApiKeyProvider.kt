package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.MissingApiKeyException
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.ProjectApiKey

/**
 * Adapter resolution project API key из CLI args и env.
 */
internal class RuntimeProjectApiKeyProvider(
    private val apiKeyResolver: ApiKeyResolver,
) : ProjectApiKeyProvider {
    override fun resolve(
        override: String?,
        credentialEnvName: CredentialEnvName,
    ): ProjectApiKeyResult =
        try {
            val apiKey = apiKeyResolver.resolve(
                override = override,
                configuredEnvName = credentialEnvName.value,
            )
            ProjectApiKeyResult.Found(ProjectApiKey(apiKey.value))
        } catch (exception: MissingApiKeyException) {
            ProjectApiKeyResult.Missing("Error: ${exception.message}")
        }
}
