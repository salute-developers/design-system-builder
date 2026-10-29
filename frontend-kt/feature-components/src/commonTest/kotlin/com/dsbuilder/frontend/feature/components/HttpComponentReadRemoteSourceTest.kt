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
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import com.dsbuilder.frontend.feature.components.data.HttpComponentReadRemoteSource
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertIs

class HttpComponentReadRemoteSourceTest {
    @Test
    fun readsConfigurationsByComponentIdAndReturnsActualContext() = runTest {
        var path = ""
        val source = source({ path = it })

        val result = source.configurations(runtime(), "component-1", "draft", 50, "10")

        val success = assertIs<ComponentReadResult.Success>(result)
        assertContains(path, "/appearances?")
        assertContains(path, "componentId=component-1")
        assertContains(path, "cursor=10")
        assertEquals(
            "ds-1",
            success.value.jsonObject.getValue("context").jsonObject.getValue("designSystemId").toString().trim('"'),
        )
    }

    @Test
    fun sendsEachSelectedValueIdWithoutGeneratorExport() = runTest {
        var path = ""
        val source = source({ path = it })

        source.resolvedProperties(runtime(), "appearance-1", listOf("value-1", "value-2"), "draft")

        assertContains(path, "/appearances/appearance-1/resolved-properties")
        assertContains(path, "selectedValueId=value-1&selectedValueId=value-2")
    }

    @Test
    fun rejectsMissingReadContext() = runTest {
        val source = source({ }, AuthenticatedHttpResult.Success("{}"))

        val result = source.tokenReferences(runtime(), "appearance-1", emptyList(), "draft")

        assertEquals(ComponentReadErrorCode.BACKEND_UNAVAILABLE, assertIs<ComponentReadResult.Failed>(result).code)
    }

    private fun source(
        onGet: (String) -> Unit,
        response: AuthenticatedHttpResult = AuthenticatedHttpResult.Success(
            "{}",
            mapOf("x-ds-read-context" to "{\"designSystemId\":\"ds-1\",\"version\":\"draft\"}"),
        ),
    ) = HttpComponentReadRemoteSource(
        object : AuthenticatedHttpClientFactory {
            override fun create(
                apiUrl: String,
                apiKey: String,
            ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult {
                    onGet(path)
                    return response
                }
                override suspend fun post(
                    path: String,
                    body: String,
                ): AuthenticatedHttpResult = error("Unexpected POST")
            }
        },
        Json,
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
