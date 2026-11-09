package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.UserSessionAccess
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.DesignSystemVersionsSource
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsClient
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadErrorCode
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsCommand
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsUseCase
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs

class DesignSystemsDiscoveryTest {
    private val id = "11111111-1111-1111-1111-111111111111"
    private fun access(active: Boolean = true): UserSessionAccess {
        val session = UserSessionCredentialResolver(
            object : RefreshTokenStore {
                override fun save(refreshToken: String) = Unit
                override fun load(): String? = null
                override fun clear() = Unit
            },
        )
        if (active) session.applyTokens(UserOAuthTokens("fixture-access", "fixture-refresh", 300))
        return UserSessionAccess(session)
    }
    private fun clients(
        response: AuthenticatedHttpResult,
        inspect: (String, BackendCredential, String) -> Unit = { _, _, _ -> },
    ): AuthenticatedHttpClientFactory = object : AuthenticatedHttpClientFactory {
        override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
            create(apiUrl, BackendCredential.PersonalAccessToken(apiKey))

        override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
            object : AuthenticatedHttpClient {
                override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
                    error("Unexpected POST")

                override suspend fun get(path: String): AuthenticatedHttpResult {
                    inspect(apiUrl, credential, path)
                    return response
                }
            }
    }

    @Test
    fun forbiddenSessionRefreshRemainsForbiddenWithoutCatalogRequest() = runTest {
        val provider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = error("Must use explicit user-session policy")

            override suspend fun resolve(request: CredentialRequest): CredentialResult {
                assertEquals(CredentialPolicy.AUTO, request.policy)
                return CredentialResult.Failed(AuthErrorCode.FORBIDDEN, "fixture-secret")
            }
        }
        val useCase = ListDesignSystemsUseCase(
            ApiUrlResolver { null },
            UserSessionAccess(provider),
            DesignSystemsClient { _, _, _ -> error("No HTTP after refresh denied") },
        )
        val result = assertIs<DesignSystemsReadResult.Failed>(useCase.execute("project"))
        assertEquals(DesignSystemsReadErrorCode.FORBIDDEN, result.code)
        assertFalse(result.message.contains("fixture-secret"))
        assertFalse(result.message.contains("auth login"))
    }

    @Test
    fun catalogReadsOnlyChosenProjectWithBearerAndAcceptsEmptyList() = runTest {
        val body = """[{"id":"s1","name":"Same","description":"first"},{"id":"s2","name":"Same"}]"""
        val client = HttpDesignSystemsClient(
            clients(AuthenticatedHttpResult.Success(body)) {
                    url,
                    credential,
                    path,
                ->
                assertEquals("https://fixture.example", url)
                assertEquals(BackendCredential.Bearer("fixture-access"), credential)
                assertEquals("/api/projects/p%2Fone/design-systems", path)
            },
        )
        val useCase = ListDesignSystemsUseCase(ApiUrlResolver { null }, access(), client)
        val result = assertIs<DesignSystemsReadResult.Success>(useCase.execute("p/one", "https://fixture.example"))
        assertEquals(listOf("s1", "s2"), result.items.map { it.id })
        assertEquals("first", result.items.first().description)
        assertIs<DesignSystemsReadResult.Success>(
            HttpDesignSystemsClient(clients(AuthenticatedHttpResult.Success("[]")))
                .list("https://fixture.example", BackendCredential.Bearer("token"), "p"),
        )
    }

    @Test
    fun missingSessionAndInvalidProjectDoNotCallBackend() = runTest {
        val client = DesignSystemsClient { _, _, _ -> error("Must not request") }
        val useCase = ListDesignSystemsUseCase(ApiUrlResolver { null }, access(false), client)
        assertEquals(
            DesignSystemsReadErrorCode.AUTH_REQUIRED,
            assertIs<DesignSystemsReadResult.Failed>(useCase.execute("p")).code,
        )
        assertEquals(
            DesignSystemsReadErrorCode.INVALID_QUERY,
            assertIs<DesignSystemsReadResult.Failed>(useCase.execute(" ")).code,
        )
    }

    @Test
    fun catalogFailuresAreDistinctAndDoNotExposeResponseBody() = runTest {
        val responses = listOf(
            AuthenticatedHttpResult.Failure("secret", 401) to DesignSystemsReadErrorCode.AUTH_REQUIRED,
            AuthenticatedHttpResult.Failure("secret", 403) to DesignSystemsReadErrorCode.FORBIDDEN,
            AuthenticatedHttpResult.Failure("secret", 404) to DesignSystemsReadErrorCode.NOT_FOUND,
            AuthenticatedHttpResult.Failure("secret", null) to DesignSystemsReadErrorCode.BACKEND_UNAVAILABLE,
            AuthenticatedHttpResult.Success("secret") to DesignSystemsReadErrorCode.INVALID_BACKEND_RESPONSE,
            AuthenticatedHttpResult.Success("""[{"id":2,"name":"invalid"}]""") to
                DesignSystemsReadErrorCode.INVALID_BACKEND_RESPONSE,
        )
        for ((response, code) in responses) {
            val result = assertIs<DesignSystemsReadResult.Failed>(
                HttpDesignSystemsClient(clients(response))
                    .list("https://fixture.example", BackendCredential.Bearer("token"), "p"),
            )
            assertEquals(code, result.code)
            assertFalse(result.message.contains("secret"))
        }
    }

    @Test
    fun discoveryPreservesServerPageAndBuildsVersionedLinksWithoutWorkspace() = runTest {
        val response = AuthenticatedHttpResult.Success(
            """[{"id":"v1","designSystemId":"$id","version":"1.2.3"}]""",
            mapOf(
                "x-ds-read-context" to """{"designSystemId":"$id"}""",
                "x-ds-page-limit" to "7",
                "x-ds-next-cursor" to "next",
            ),
        )
        val source = HttpDesignSystemVersionsSource(
            clients(response) { _, credential, path ->
                assertIs<BackendCredential.Bearer>(credential)
                val expectedPath = "/api/projects/p1/design-systems/$id/versions"
                assertEquals("$expectedPath?limit=7&cursor=before", path)
                assertFalse(path.contains("version="))
            },
        )
        val result = DiscoverDesignSystemVersionsUseCase(ApiUrlResolver { null }, access(), source)
            .execute(DiscoverDesignSystemVersionsCommand("p1", id, 7, "before"))
        val value = assertIs<ModelReadResult.Success>(result).value.jsonObject
        assertEquals("next", value["nextCursor"]?.jsonPrimitive?.content)
        val item = value.getValue("items").jsonArray.single().jsonObject
        val uri = item.getValue("designSystem").jsonPrimitive.content
        assertEquals("dsbuilder://projects/p1/design-systems/$id?version=1.2.3", uri)
    }

    @Test
    fun discoveryRejectsInvalidLimitsAndForeignOrDraftVersions() = runTest {
        val unavailable = DesignSystemVersionsSource { _, _, _ -> error("No request") }
        val useCase = DiscoverDesignSystemVersionsUseCase(ApiUrlResolver { null }, access(), unavailable)
        assertEquals(
            "INVALID_QUERY",
            assertIs<ModelReadResult.Failed>(
                useCase.execute(
                    DiscoverDesignSystemVersionsCommand(
                        "p",
                        id,
                        0,
                    ),
                ),
            ).code,
        )
        for (version in listOf("draft", "latest", "1.2.3")) {
            val source = DesignSystemVersionsSource { _, _, _ ->
                ModelReadResult.Success(
                    buildJsonObject {
                        put("context", buildJsonObject { put("designSystemId", id) })
                        put(
                            "items",
                            buildJsonArray {
                                add(
                                    buildJsonObject {
                                        put(
                                            "designSystemId",
                                            if (version == "1.2.3") "foreign" else id,
                                        )
                                        put(
                                            "version",
                                            version,
                                        )
                                    },
                                )
                            },
                        )
                    },
                )
            }
            assertEquals(
                "INVALID_BACKEND_RESPONSE",
                assertIs<ModelReadResult.Failed>(
                    DiscoverDesignSystemVersionsUseCase(
                        ApiUrlResolver {
                            null
                        },
                        access(),
                        source,
                    )
                        .execute(DiscoverDesignSystemVersionsCommand("p", id)),
                ).code,
            )
        }
    }
}
