package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadErrorCode
import com.dsbuilder.frontend.feature.docs.application.DocsReadResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadRuntime
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertIs

class HttpDocsReadRemoteSourceTest {
    @Test
    fun explicitPublicationUsesIdRouteWithoutActiveLookup() = runTest {
        val paths = mutableListOf<String>()
        val source = source(paths)

        val result = source.navigation(runtime(), DocumentationPublicationCommand(null, null, "publication-1"))

        assertIs<DocsReadResult.Success>(result)
        assertEquals(listOf("/api/projects/project-1/documentation/publications/publication-1/navigation"), paths)
    }

    @Test
    fun explicitMismatchIsRejectedFromActualMetadata() = runTest {
        val source = source(mutableListOf())

        val result = source.navigation(runtime(), DocumentationPublicationCommand("2.0.0", null, "publication-1"))

        assertEquals(DocsReadErrorCode.INVALID_QUERY, assertIs<DocsReadResult.Failed>(result).code)
    }

    @Test
    fun subjectsAreSentAsSeparateValues() = runTest {
        val paths = mutableListOf<String>()
        val source = source(paths)

        source.search(
            runtime(),
            DocumentationSearchCommand(
                "button",
                null,
                null,
                null,
                null,
                null,
                "publication-1",
                listOf("components.a", "components.b"),
            ),
        )

        assertContains(paths.single(), "subject=components.a&subject=components.b")
    }

    @Test
    fun searchRequiresPublicationContextForContinuation() = runTest {
        val command = DocumentationSearchCommand("button", "1.0.0", "compose", null, null, null, null, emptyList())
        val missing = source(mutableListOf(), emptyMap()).search(runtime(), command)
        assertEquals(DocsReadErrorCode.BACKEND_UNAVAILABLE, assertIs<DocsReadResult.Failed>(missing).code)

        val incomplete = source(
            mutableListOf(),
            mapOf(
                "x-ds-read-context" to
                    "{\"designSystemId\":\"ds-1\",\"version\":\"1.0.0\",\"platform\":\"compose\"}",
            ),
        ).search(runtime(), command)
        assertEquals(DocsReadErrorCode.BACKEND_UNAVAILABLE, assertIs<DocsReadResult.Failed>(incomplete).code)
    }

    @Test
    fun searchPreservesActualPublicationId() = runTest {
        val result = source(mutableListOf()).search(
            runtime(),
            DocumentationSearchCommand("button", "1.0.0", "compose", null, null, null, null, emptyList()),
        )

        assertContains(assertIs<DocsReadResult.Success>(result).value.toString(), "\"publicationId\":\"publication-1\"")
    }

    @Test
    fun explicitSearchAcceptsAnotherDesignSystemInActualContext() = runTest {
        val result = source(
            mutableListOf(),
            mapOf(
                "x-ds-read-context" to
                    "{\"designSystemId\":\"other-ds\",\"version\":\"1.0.0\"," +
                    "\"platform\":\"compose\",\"publicationId\":\"publication-1\"}",
            ),
        ).search(
            runtime(),
            DocumentationSearchCommand("button", null, null, null, null, null, "publication-1", emptyList()),
        )

        assertContains(assertIs<DocsReadResult.Success>(result).value.toString(), "\"designSystemId\":\"other-ds\"")
    }

    private fun source(
        paths: MutableList<String>,
        headers: Map<String, String> = mapOf(
            "x-ds-read-context" to
                "{\"designSystemId\":\"ds-1\",\"version\":\"1.0.0\"," +
                "\"platform\":\"compose\",\"publicationId\":\"publication-1\"}",
        ),
    ) = HttpDocsReadRemoteSource(
        object : AuthenticatedHttpClientFactory {
            override fun create(
                apiUrl: String,
                apiKey: String,
            ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult {
                    paths += path
                    return AuthenticatedHttpResult.Success("{}", headers)
                }
                override suspend fun post(
                    path: String,
                    body: String,
                ): AuthenticatedHttpResult = error("Unexpected POST")
            }
        },
        Json,
    )

    private fun runtime() = DocsReadRuntime(
        ProjectContext(
            ProjectId("project-1"),
            DesignSystemId("ds-1"),
            CredentialEnvName("DSBUILDER_API_KEY"),
            "/work/.sdds/config.json",
        ),
        ProjectApiUrl("https://api.example.com"),
        BackendCredential.ProjectKey("test-key"),
    )
}
