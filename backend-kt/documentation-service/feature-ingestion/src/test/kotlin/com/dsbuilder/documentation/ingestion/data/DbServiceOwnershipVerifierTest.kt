@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.OwnershipResult
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DbServiceOwnershipVerifierTest {
    @Test fun `request uses internal URL and trusted headers without authorization`() = runBlocking {
        val engine = MockEngine { request ->
            assertEquals("http://db:3008/api/ds/design-systems/ds-1", request.url.toString())
            assertEquals("project-1", request.headers["X-Project-Id"])
            assertEquals("user-1", request.headers["X-User-Id"])
            assertNull(request.headers["Authorization"])
            respond("{}", HttpStatusCode.OK, headersOf("Content-Type", "application/json"))
        }
        assertEquals(OwnershipResult.OWNED, verifier(engine).verify("ds-1", user()))
    }

    @Test fun `404 maps to not found`() = assertMapping(HttpStatusCode.NotFound, OwnershipResult.NOT_FOUND)

    @Test fun `401 maps to forbidden`() = assertMapping(HttpStatusCode.Unauthorized, OwnershipResult.FORBIDDEN)

    @Test fun `403 maps to forbidden`() = assertMapping(HttpStatusCode.Forbidden, OwnershipResult.FORBIDDEN)

    @Test fun `500 maps to unavailable`() = assertMapping(
        HttpStatusCode.InternalServerError,
        OwnershipResult.UNAVAILABLE,
    )

    @Test fun `created does not prove ownership`() = assertMapping(HttpStatusCode.Created, OwnershipResult.UNAVAILABLE)

    @Test fun `multiple choices does not prove ownership`() = assertMapping(
        HttpStatusCode.MultipleChoices,
        OwnershipResult.UNAVAILABLE,
    )

    @Test fun `redirect does not prove ownership`() = assertMapping(HttpStatusCode.Found, OwnershipResult.UNAVAILABLE)

    private fun assertMapping(status: HttpStatusCode, expected: OwnershipResult) = runBlocking {
        assertEquals(expected, verifier(MockEngine { respond("", status) }).verify("ds-1", user()))
    }

    private fun verifier(engine: MockEngine) = DbServiceOwnershipVerifier(
        HttpClient(engine) {
            followRedirects = false
        },
        "http://db:3008/",
    )
    private fun user() = ActorContext(ActorType.USER, "user-1", "project-1", "editor")
}
