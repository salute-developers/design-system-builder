package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Characterization-тесты на текущее поведение [RuntimeProjectApiKeyProvider]: перенесены при
 * выносе `core.data.RuntimeProjectApiKeyProvider` в отдельный Gradle-модуль `core-application`
 * (ADR-0004).
 */
class RuntimeProjectApiKeyProviderTest {
    @Test
    fun returnsFoundWhenResolverFindsKey() {
        val provider = RuntimeProjectApiKeyProvider(
            ApiKeyResolver(EnvironmentReader { name -> if (name == "DSBUILDER_API_KEY") "secret-value" else null }),
        )

        val result = provider.resolve(override = null, credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"))

        assertIs<ProjectApiKeyResult.Found>(result)
        assertEquals("secret-value", result.value.value)
    }

    @Test
    fun returnsMissingWithErrorPrefixWhenResolverThrows() {
        val provider = RuntimeProjectApiKeyProvider(ApiKeyResolver(EnvironmentReader { null }))

        val result = provider.resolve(override = null, credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"))

        assertIs<ProjectApiKeyResult.Missing>(result)
        assertEquals(
            "Error: API key is not configured. Set one of: DSBUILDER_API_KEY, or pass --api-key.",
            result.message,
        )
    }
}
