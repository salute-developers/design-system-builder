package com.dsbuilder.frontend.feature.theme

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.theme.application.TokenListReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenReadErrorCode
import com.dsbuilder.frontend.feature.theme.application.TokenReadResult
import com.dsbuilder.frontend.feature.theme.application.TokenReadRuntime
import com.dsbuilder.frontend.feature.theme.data.HttpTokenReadRemoteSource
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class HttpTokenReadRemoteSourceTest {
    @Test
    fun listUsesProjectScopedDesignSystemPathAndWrapsStableSource() = runTest {
        var requestedPath = ""
        val source = HttpTokenReadRemoteSource(
            httpClientFactory = FakeHttpClientFactory { path ->
                requestedPath = path
                AuthenticatedHttpResult.Success("""[{"id":"token-1","name":"accent"}]""")
            },
            json = Json,
        )

        val result = source.list(runtime(), TokenListReadCommand(type = "color", query = "accent"))
        val body = assertIs<TokenReadResult.Success>(result).value.jsonObject

        assertEquals(
            "/api/projects/project-1/ds/design-systems/ds-1/tokens?type=color&query=accent",
            requestedPath,
        )
        assertEquals("design-system-model-api", body.getValue("source").jsonPrimitive.content)
        assertEquals(
            "accent",
            body.getValue("data").jsonArray.single().jsonObject.getValue("name").jsonPrimitive.content,
        )
    }

    @Test
    fun forbiddenBackendFailureMapsToStableCode() = runTest {
        val source = HttpTokenReadRemoteSource(
            httpClientFactory = FakeHttpClientFactory {
                AuthenticatedHttpResult.Failure("Status: forbidden. API key has no access to this project.", 403)
            },
            json = Json,
        )

        val result = source.list(runtime(), TokenListReadCommand(type = null, query = null))

        assertEquals(TokenReadErrorCode.FORBIDDEN, assertIs<TokenReadResult.Failed>(result).code)
    }

    private fun runtime(): TokenReadRuntime = TokenReadRuntime(
        context = ProjectContext(
            projectId = ProjectId("project-1"),
            designSystemId = DesignSystemId("ds-1"),
            credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
            configPath = "/work/.sdds/config.json",
        ),
        apiUrl = ProjectApiUrl("https://api.example.com"),
        credential = BackendCredential.ProjectKey("secret-value"),
    )

    private class FakeHttpClientFactory(
        private val onGet: (String) -> AuthenticatedHttpResult,
    ) : AuthenticatedHttpClientFactory {
        override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
            error("Project-key overload should not be used.")

        override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
            object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult = onGet(path)

                override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
                    error("Unexpected POST")
            }
    }
}
