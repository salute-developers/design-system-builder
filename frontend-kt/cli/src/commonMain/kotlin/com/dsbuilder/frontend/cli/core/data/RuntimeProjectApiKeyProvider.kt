package com.dsbuilder.frontend.cli.core.data

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.cli.core.config.CredentialReference
import com.dsbuilder.frontend.cli.core.config.CredentialReferenceType
import com.dsbuilder.frontend.cli.core.credentials.ApiKeyResolver
import com.dsbuilder.frontend.cli.core.credentials.MissingApiKeyException
import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey

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
                credentialReference = CredentialReference(
                    type = CredentialReferenceType.ENV,
                    name = credentialEnvName.value,
                ),
            )
            ProjectApiKeyResult.Found(ProjectApiKey(apiKey.value))
        } catch (exception: MissingApiKeyException) {
            ProjectApiKeyResult.Missing("Error: ${exception.message}")
        }
}
