package com.dsbuilder.frontend.feature.projects.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.projects.application.Project
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadErrorCode
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class HttpProjectsClientTest {
    private fun factory(handler: (HttpRequestData) -> Pair<HttpStatusCode, String>): AuthenticatedHttpClientFactory {
        val engine = MockEngine { request ->
            val (status, body) = handler(request)
            respond(content = body, status = status)
        }
        return KtorAuthenticatedHttpClientFactory { HttpClient(engine) }
    }

    @Test
    fun parsesProjectListAndSendsBearerAuthorization() = runTest {
        var request: HttpRequestData? = null
        val client = HttpProjectsClient(
            factory {
                request = it
                HttpStatusCode.OK to """
                    [
                      {"id":"p1","name":"Project One","description":"first"},
                      {"id":"p2","name":"Project Two","description":null}
                    ]
                """.trimIndent()
            },
        )

        val result = client.listProjects("https://gateway.example.com", BackendCredential.Bearer("access-a"))

        assertIs<ProjectsReadResult.Success>(result)
        assertEquals(
            listOf(
                Project(id = "p1", name = "Project One", description = "first"),
                Project(id = "p2", name = "Project Two", description = null),
            ),
            result.projects,
        )
        assertEquals("Bearer access-a", request!!.headers[HttpHeaders.Authorization])
        assertEquals("/api/projects", request!!.url.encodedPath)
    }

    @Test
    fun emptyListIsSuccess() = runTest {
        val client = HttpProjectsClient(factory { HttpStatusCode.OK to "[]" })

        val result = client.listProjects("https://gateway.example.com", BackendCredential.Bearer("access-a"))

        assertIs<ProjectsReadResult.Success>(result)
        assertEquals(emptyList(), result.projects)
    }

    @Test
    fun unauthorizedMapsToAuthRequired() = runTest {
        val client = HttpProjectsClient(factory { HttpStatusCode.Unauthorized to "" })

        val result = client.listProjects("https://gateway.example.com", BackendCredential.Bearer("expired"))

        assertIs<ProjectsReadResult.Failed>(result)
        assertEquals(ProjectsReadErrorCode.AUTH_REQUIRED, result.code)
    }

    @Test
    fun malformedBodyMapsToBackendUnavailable() = runTest {
        val client = HttpProjectsClient(factory { HttpStatusCode.OK to "not-json" })

        val result = client.listProjects("https://gateway.example.com", BackendCredential.Bearer("access-a"))

        assertIs<ProjectsReadResult.Failed>(result)
        assertEquals(ProjectsReadErrorCode.BACKEND_UNAVAILABLE, result.code)
    }
}
