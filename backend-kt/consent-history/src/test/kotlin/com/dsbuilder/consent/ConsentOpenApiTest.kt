package com.dsbuilder.consent

import org.yaml.snakeyaml.Yaml
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ConsentOpenApiTest {
    @Test fun sourceContractExposesExactlyTwoOperationsAndOwnKey() {
        val stream = requireNotNull(javaClass.getResourceAsStream("/dsbuilder/consent/openapi/documentation.yaml"))
        val document = stream.use { Yaml().load<Map<String, Any>>(it) }
        val paths = document["paths"] as Map<*, *>
        assertEquals(setOf("/api/privacy/analytics/consent"), paths.keys)
        val route = paths.values.single() as Map<*, *>
        assertEquals(setOf("parameters", "get", "post"), route.keys)
        val key = (route["parameters"] as List<*>).single() as Map<*, *>
        assertEquals("X-Consent-Key", key["name"])
        assertEquals(true, key["required"])
        val schemas = ((document["components"] as Map<*, *>)["schemas"] as Map<*, *>)
        val decision = schemas["ConsentDecision"] as Map<*, *>
        val required = decision["required"] as List<*>
        assertTrue(required.containsAll(listOf("request_id", "client_group", "decision", "expected_revision")))
        assertEquals(false, decision["additionalProperties"])
    }
}
