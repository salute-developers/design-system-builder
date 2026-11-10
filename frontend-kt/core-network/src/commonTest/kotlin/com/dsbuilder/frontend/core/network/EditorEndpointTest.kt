package com.dsbuilder.frontend.core.network

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class EditorEndpointTest {
    @Test
    fun pathTemplatesAreValidOnJavaScriptAndKeepOnlyPayloadFieldsInTheBody() {
        val endpoint = EditorEndpoint(MutationHttpMethod.PATCH, "/appearances/{appearanceId}/axes/{axisId}")
        val command = Json.parseToJsonElement(
            """{"operation":"update","appearanceId":"config-1","axisId":"axis_2","displayName":null}""",
        ).jsonObject
        val request = endpoint.request("/api/projects/p/design-systems/d", command, "same-key", 3)
        assertEquals("/api/projects/p/design-systems/d/appearances/config-1/axes/axis_2", request.path)
        assertEquals("""{"displayName":null}""", request.body)
        assertEquals("same-key", request.idempotencyKey)
        assertEquals(3, request.baseRevision)
    }

    @Test
    fun routeParametersCannotEscapeTheSelectedSystem() {
        val endpoint = EditorEndpoint(MutationHttpMethod.DELETE, "/tokens/{tokenId}", sendsBody = false)
        val command = Json.parseToJsonElement("""{"tokenId":"../../other-system/tokens/token"}""").jsonObject
        assertFailsWith<IllegalArgumentException> {
            endpoint.request("/api/projects/p/design-systems/d", command, "key", null)
        }
    }
}
