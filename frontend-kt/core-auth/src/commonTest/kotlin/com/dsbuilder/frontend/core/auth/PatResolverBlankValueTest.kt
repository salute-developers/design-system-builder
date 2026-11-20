package com.dsbuilder.frontend.core.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Characterization-тесты на blank-значения в [PatResolver]: сохраняются перед переносом
 * в отдельный Gradle-модуль `core-auth`. Приоритет `--api-key` / configured env / default env
 * уже покрыт `DsBuilderCliTest`.
 */
class PatResolverBlankValueTest {
    private val configuredEnvName = "DSBUILDER_PROJECT_A_API_KEY"

    @Test
    fun blankOverrideIsIgnoredAndFallsBackToEnv() {
        val resolver = PatResolver(
            EnvironmentReader { name -> if (name == "DSBUILDER_PROJECT_A_API_KEY") "from-config-env" else null },
        )

        val result = resolver.resolve(override = "   ", configuredEnvName = configuredEnvName)

        assertEquals("from-config-env", result.value)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", result.source)
    }

    @Test
    fun blankConfiguredEnvValueFallsBackToDefaultEnv() {
        val resolver = PatResolver(
            EnvironmentReader { name ->
                when (name) {
                    "DSBUILDER_PROJECT_A_API_KEY" -> ""
                    "DSBUILDER_API_KEY" -> "from-default-env"
                    else -> null
                }
            },
        )

        val result = resolver.resolve(override = null, configuredEnvName = configuredEnvName)

        assertEquals("from-default-env", result.value)
        assertEquals("DSBUILDER_API_KEY", result.source)
    }

    @Test
    fun missingCredentialReferenceFallsBackToDefaultEnvOnly() {
        val resolver = PatResolver(
            EnvironmentReader { name -> if (name == "DSBUILDER_API_KEY") "from-default-env" else null },
        )

        val result = resolver.resolve(override = null, configuredEnvName = null)

        assertEquals("from-default-env", result.value)
        assertEquals("DSBUILDER_API_KEY", result.source)
    }

    @Test
    fun missingCredentialReferenceAndEnvThrowsWithDefaultEnvOnly() {
        val exception = assertFailsWith<MissingPatException> {
            PatResolver(EnvironmentReader { null }).resolve(override = null, configuredEnvName = null)
        }

        assertEquals("API key is not configured. Set one of: DSBUILDER_API_KEY, or pass --api-key.", exception.message)
    }
}
