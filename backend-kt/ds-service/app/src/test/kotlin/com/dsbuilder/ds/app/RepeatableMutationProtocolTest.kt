package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondIdempotentReplay
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.header
import io.ktor.server.response.respondText
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Проверяет границы транспортного протокола без базы данных. */
class RepeatableMutationProtocolTest {
    @Test
    fun `only mutation methods configure keyed commands`() = testApplication {
        application {
            routing {
                route("/probe") {
                    handle {
                        val context = DsRequestContext(
                            ProjectPrincipal(ProjectActorType.USER, "actor", "project", "editor"),
                            "protocol",
                        )
                        val command = call.repeatableMutation<String, String>(context, "body") { it }
                        call.response.header("X-Command-Configured", (command.mutationRequest != null).toString())
                        call.respondText("ok")
                    }
                }
            }
        }
        listOf(HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Delete).forEach { method ->
            val response = client.request("/probe") {
                this.method = method
                header("Idempotency-Key", "write")
            }
            assertEquals("true", response.headers["X-Command-Configured"], method.value)
        }
        listOf(HttpMethod.Get, HttpMethod.Head, HttpMethod.Options).forEach { method ->
            val response = client.request("/probe") {
                this.method = method
                header("Idempotency-Key", "read")
            }
            assertEquals("false", response.headers["X-Command-Configured"], method.value)
        }
        assertEquals("false", client.request("/probe") { method = HttpMethod.Patch }.headers["X-Command-Configured"])
    }

    @Test
    fun `legacy results request reconciliation and large replay metadata is bounded`() = testApplication {
        val metadata = (1..100).joinToString(",", "[", "]") { """{"entityId":"$it","path":"${"x".repeat(80)}"}""" }
        application {
            routing {
                route("/legacy") { handle { call.respondIdempotentReplay(IdempotentResponse(200, "{}", null, false)) } }
                route("/large") { handle { call.respondIdempotentReplay(IdempotentResponse(201, "{}", metadata)) } }
                route("/empty") { handle { call.respondIdempotentReplay(IdempotentResponse(200, "{}")) } }
            }
        }
        val legacy = client.request("/legacy")
        assertEquals("[]", legacy.headers["X-DS-Mutation-Metadata"])
        assertEquals("true", legacy.headers["X-DS-Mutation-Metadata-Truncated"])
        val large = client.request("/large")
        assertEquals(HttpStatusCode.Created, large.status)
        assertEquals("true", large.headers["X-DS-Mutation-Metadata-Truncated"])
        assertTrue(requireNotNull(large.headers["X-DS-Mutation-Metadata"]).encodeToByteArray().size <= 2048)
        assertEquals(null, client.request("/empty").headers["X-DS-Mutation-Metadata-Truncated"])
    }
}
