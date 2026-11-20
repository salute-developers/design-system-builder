package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.MissingPatException
import com.dsbuilder.frontend.core.auth.PatResolver
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.PersonalAccessToken

/**
 * Adapter resolution PAT из CLI args и env.
 */
internal class RuntimePersonalAccessTokenProvider(
    private val apiKeyResolver: PatResolver,
) : PersonalAccessTokenProvider {
    override fun resolve(
        override: String?,
        credentialEnvName: CredentialEnvName,
    ): PersonalAccessTokenResult =
        try {
            val apiKey = apiKeyResolver.resolve(
                override = override,
                configuredEnvName = credentialEnvName.value,
            )
            PersonalAccessTokenResult.Found(PersonalAccessToken(apiKey.value))
        } catch (exception: MissingPatException) {
            PersonalAccessTokenResult.Missing("Error: ${exception.message}")
        }
}
