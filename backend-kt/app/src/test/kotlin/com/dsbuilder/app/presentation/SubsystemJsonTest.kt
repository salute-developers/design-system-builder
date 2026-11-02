package com.dsbuilder.app.presentation

import com.dsbuilder.ds.app.DsMetrics
import com.dsbuilder.ds.app.installDsHttpPlugins
import com.dsbuilder.ds.core.presentation.configureDsPublicEntry
import com.dsbuilder.projects.feature.projects.presentation.projectsPublicEntry
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Headers
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class SubsystemJsonTest {
    @Serializable
    private data class Payload(val name: String, val description: String? = null)

    @Test
    fun `real HTTP plugins isolate project JSON from strict DS and documentation JSON`() = testApplication {
        application {
            installDsHttpPlugins(Json { explicitNulls = true }, DsMetrics(), ::cacheDsJsonBody)
            configureDsPublicEntry("/api/projects/{projectId}/ds") { Headers.Empty }
            routing {
                projectsPublicEntry().post("/api/projects") { call.respond(call.receive<Payload>()) }
                post("/api/projects/{projectId}/ds/design-systems") { call.respond(call.receive<Payload>()) }
                post("/api/projects/p/ds/probe") { call.respond(call.receive<Payload>()) }
                post("/api/projects/p/documentation/probe") { call.respond(call.receive<Payload>()) }
            }
        }
        val body = """{"name":"probe","unknown":true}"""
        val project = client.post("/api/projects") {
            header("Content-Type", "application/json")
            setBody(body)
        }
        assertEquals(HttpStatusCode.OK, project.status)
        assertEquals("""{"name":"probe"}""", project.bodyAsText())
        for (path in listOf("/api/projects/p/ds/probe", "/api/projects/p/documentation/probe")) {
            val strict = client.post(path) {
                header("Content-Type", "application/json")
                setBody(body)
            }
            assertEquals(HttpStatusCode.BadRequest, strict.status)
        }
        for (contentType in listOf("application/json", "Application/Json; Charset=UTF-8")) {
            val invalid = client.post("/api/projects/p/ds/design-systems") {
                header("Content-Type", contentType)
                setBody("""{"name":42,"projectName":"alpha"}""")
            }
            assertEquals(HttpStatusCode.BadRequest, invalid.status)
            assertEquals(
                """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                    """["Invalid input: expected string, received number"]}}}""",
                invalid.bodyAsText(),
            )
        }
    }
}
