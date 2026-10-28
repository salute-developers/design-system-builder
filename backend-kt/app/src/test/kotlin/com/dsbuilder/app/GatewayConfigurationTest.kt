package com.dsbuilder.app

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GatewayConfigurationTest {
    @Test
    fun `env overrides gateway settings without compose`() {
        val config = GatewayConfiguration.fromEnvironment(
            mapOf(
                "BACKEND_PORT" to "8181",
                "KEYCLOAK_REALM" to "another",
                "DOCUMENTATION_MAX_REQUEST_SIZE" to "12m",
            ),
        )
        assertEquals(8181, config.port)
        assertEquals("another", config.realm)
        assertEquals(12L * 1024 * 1024, config.documentationMaxBytes)
    }

    @Test
    fun `invalid limits and upstreams fail before initialization`() {
        for (env in listOf(
            mapOf("BACKEND_PORT" to "0"),
            mapOf("GATEWAY_PROXY_TIMEOUT_SECONDS" to "-1"),
            mapOf("DOCUMENTATION_MAX_REQUEST_SIZE" to "0m"),
            mapOf("KEYCLOAK_INTERNAL_URL" to "file:///tmp/keycloak"),
        )) {
            assertFailsWith<IllegalArgumentException> { GatewayConfiguration.fromEnvironment(env) }
        }
    }

    @Test
    fun `invalid numeric env identifies parameter without exposing value`() {
        val failure = assertFailsWith<IllegalArgumentException> {
            GatewayConfiguration.fromEnvironment(mapOf("BACKEND_PORT" to "private-invalid-value"))
        }
        assertTrue(failure.message.orEmpty().contains("BACKEND_PORT"))
        assertTrue(!failure.message.orEmpty().contains("private-invalid-value"))
    }
}
