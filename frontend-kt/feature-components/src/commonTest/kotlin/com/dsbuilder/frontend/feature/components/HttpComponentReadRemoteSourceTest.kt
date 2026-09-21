package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import com.dsbuilder.frontend.feature.components.data.HttpComponentReadRemoteSource
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs

class HttpComponentReadRemoteSourceTest {
    @Test
    fun omittedStyleIsAbsentFromExportRequest() = runTest {
        var requestBody = ""
        val source = source { requestBody = it }

        assertIs<ComponentReadResult.Success>(
            source.config(runtime(), ComponentConfigReadCommand("basic-button", null)),
        )

        val body = Json.parseToJsonElement(requestBody).jsonObject
        assertEquals("ds-1", body.getValue("designSystemId").jsonPrimitive.content)
        assertEquals("basic-button", body.getValue("components").jsonArray.single().jsonPrimitive.content)
        assertFalse(body.containsKey("styles"))
    }

    @Test
    fun explicitStyleIsSentAsArray() = runTest {
        var requestBody = ""
        val source = source { requestBody = it }

        source.config(runtime(), ComponentConfigReadCommand("basic-button", "basic-button"))

        val styles = Json.parseToJsonElement(requestBody).jsonObject.getValue("styles").jsonArray
        assertEquals("basic-button", styles.single().jsonPrimitive.content)
    }

    @Test
    fun detailAndVariationReadsReuseIdRoutesWhileStylesStayAggregated() = runTest {
        val requestedPaths = mutableListOf<String>()
        val source = HttpComponentReadRemoteSource(
            object : AuthenticatedHttpClientFactory {
                override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                    error("Project-key overload should not be used.")

                override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
                    object : AuthenticatedHttpClient {
                        override suspend fun get(path: String): AuthenticatedHttpResult {
                            requestedPaths += path
                            return AuthenticatedHttpResult.Success("{}")
                        }

                        override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
                            error("Unexpected POST")
                    }
            },
            Json,
        )
        val command = ComponentGetReadCommand("component-1")

        source.get(runtime(), command)
        source.variations(runtime(), command)
        source.styles(runtime(), command)

        assertEquals(
            listOf(
                "/api/projects/project-1/ds/components/component-1",
                "/api/projects/project-1/ds/components/component-1/variations",
                "/api/projects/project-1/ds/design-systems/ds-1/components/component-1/styles",
            ),
            requestedPaths,
        )
    }

    private fun source(onPost: (String) -> Unit) = HttpComponentReadRemoteSource(
        object : AuthenticatedHttpClientFactory {
            override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                object : AuthenticatedHttpClient {
                    override suspend fun get(path: String): AuthenticatedHttpResult = error("Unexpected GET")

                    override suspend fun post(path: String, body: String): AuthenticatedHttpResult {
                        onPost(body)
                        return AuthenticatedHttpResult.Success("{\"components\":[]}")
                    }
                }
        },
        Json {
            encodeDefaults = true
            explicitNulls = true
        },
    )

    private fun runtime() = ComponentReadRuntime(
        context = ProjectContext(
            ProjectId("project-1"),
            DesignSystemId("ds-1"),
            CredentialEnvName("DSBUILDER_API_KEY"),
            "/work/.sdds/config.json",
        ),
        apiUrl = ProjectApiUrl("https://api.example.com"),
        credential = BackendCredential.ProjectKey("test-key"),
    )
}
