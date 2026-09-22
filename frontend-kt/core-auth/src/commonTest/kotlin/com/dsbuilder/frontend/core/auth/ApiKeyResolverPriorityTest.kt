package com.dsbuilder.frontend.core.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Перенесено из `cli/DsBuilderCliTest.kt` при выносе `core.credentials` в отдельный
 * Gradle-модуль `core-auth` (ADR-0004).
 */
class ApiKeyResolverPriorityTest {
    private val configuredEnvName = "DSBUILDER_PROJECT_A_API_KEY"

    @Test
    fun processValueWinsForConfiguredNameButProjectNameWinsOverDefaultName() {
        val project = EnvironmentReader { name ->
            if (name == configuredEnvName) "project-configured" else null
        }
        val process = ApiKeyResolver(
            EnvironmentReader { name ->
                when (name) {
                    configuredEnvName -> "process-configured"
                    DEFAULT_API_KEY_ENV -> "process-default"
                    else -> null
                }
            },
        )
        assertEquals("process-configured", process.resolve(null, configuredEnvName, project).value)

        val defaultOnly = ApiKeyResolver(
            EnvironmentReader { name ->
                if (name == DEFAULT_API_KEY_ENV) "process-default" else null
            },
        )
        assertEquals("project-configured", defaultOnly.resolve(null, configuredEnvName, project).value)
    }

    @Test
    fun apiKeyArgumentHasPriorityOverEnvironment() {
        val resolver = ApiKeyResolver(
            EnvironmentReader { name ->
                when (name) {
                    "DSBUILDER_PROJECT_A_API_KEY" -> "from-config-env"
                    "DSBUILDER_API_KEY" -> "from-default-env"
                    else -> null
                }
            },
        )

        val result = resolver.resolve("from-arg", configuredEnvName)

        assertEquals("from-arg", result.value)
        assertEquals("--api-key", result.source)
    }

    @Test
    fun apiKeyUsesConfiguredEnvThenFallbackEnv() {
        val configured = ApiKeyResolver(
            EnvironmentReader { name ->
                if (name == "DSBUILDER_PROJECT_A_API_KEY") "from-config-env" else null
            },
        ).resolve(null, configuredEnvName)
        val fallback = ApiKeyResolver(
            EnvironmentReader { name ->
                if (name == "DSBUILDER_API_KEY") "from-default-env" else null
            },
        ).resolve(null, configuredEnvName)

        assertEquals("from-config-env", configured.value)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", configured.source)
        assertEquals("from-default-env", fallback.value)
        assertEquals("DSBUILDER_API_KEY", fallback.source)
    }

    @Test
    fun missingApiKeyMentionsConfiguredEnvName() {
        val exception = assertFailsWith<MissingApiKeyException> {
            ApiKeyResolver(EnvironmentReader { null }).resolve(null, configuredEnvName)
        }

        assertNotNull(exception.message)
        assertTrue(exception.message!!.contains("DSBUILDER_PROJECT_A_API_KEY"))
        assertTrue(exception.message!!.contains("DSBUILDER_API_KEY"))
    }
}
