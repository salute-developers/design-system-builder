package com.dsbuilder.frontend.feature.status

import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectAccessCheck
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.feature.status.data.HttpProjectAccessVerifier
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpStatusCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Characterization-тесты на текущее поведение [HttpProjectAccessVerifier]: сохраняются перед
 * переносом в отдельный Gradle-модуль `feature-status`.
 */
class HttpProjectAccessVerifierTest {
    private val check = ProjectAccessCheck(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        apiUrl = ProjectApiUrl("https://api.example.com"),
        apiKey = ProjectApiKey("secret-value"),
    )

    private fun factory(handler: (HttpRequestData) -> Pair<HttpStatusCode, String>): AuthenticatedHttpClientFactory {
        val engine = MockEngine { request ->
            val (status, body) = handler(request)
            respond(content = body, status = status)
        }
        return KtorAuthenticatedHttpClientFactory { HttpClient(engine) }
    }

    @Test
    fun returnsAuthorizedWhenBothRequestsSucceed() {
        val requestedPaths = mutableListOf<String>()
        val verifier = HttpProjectAccessVerifier(
            factory { request ->
                requestedPaths += request.url.encodedPath
                if (request.url.encodedPath.endsWith("/ds/design-systems/ds-a")) {
                    HttpStatusCode.OK to """{"name":"DS A"}"""
                } else {
                    HttpStatusCode.OK to """{"name":"Project A"}"""
                }
            },
        )

        val result = verifier.verify(check)

        assertIs<ProjectAccessResult.Authorized>(result)
        assertEquals("Project A", result.projectName)
        assertEquals("DS A", result.designSystemName)
        assertEquals(
            listOf("/api/projects/project-a", "/api/projects/project-a/ds/design-systems/ds-a"),
            requestedPaths,
        )
    }

    @Test
    fun returnsFailedWhenProjectRequestIsUnauthorized() {
        val verifier = HttpProjectAccessVerifier(
            factory { HttpStatusCode.Unauthorized to "{}" },
        )

        val result = verifier.verify(check)

        assertIs<ProjectAccessResult.Failed>(result)
        assertEquals("Status: unauthorized. API key is missing or invalid.", result.message)
    }

    @Test
    fun returnsFailedWhenDesignSystemRequestIsNotFound() {
        val verifier = HttpProjectAccessVerifier(
            factory { request ->
                if (request.url.encodedPath.endsWith("/ds/design-systems/ds-a")) {
                    HttpStatusCode.NotFound to "{}"
                } else {
                    HttpStatusCode.OK to """{"name":"Project A"}"""
                }
            },
        )

        val result = verifier.verify(check)

        assertIs<ProjectAccessResult.Failed>(result)
        assertEquals("Status: not found. Project or resource was not found.", result.message)
    }

    @Test
    fun returnsFailedWhenProjectResponseCannotBeParsed() {
        val verifier = HttpProjectAccessVerifier(
            factory { HttpStatusCode.OK to "not-json" },
        )

        val result = verifier.verify(check)

        assertIs<ProjectAccessResult.Failed>(result)
        assertEquals("Status: failed. Cannot parse project response.", result.message)
    }
}
