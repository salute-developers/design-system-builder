package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.HttpMutationRequest
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.core.network.MultipartFile
import com.dsbuilder.frontend.core.network.MutationHttpMethod
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class RefreshingAuthenticatedHttpClientFactoryTest {
    @Test
    fun bearerRetriesOnceAfterTyped401() = runTest {
        val attempts = mutableListOf<BackendCredential>()
        var refreshes = 0
        val factory = factory(attempts) {
            refreshes += 1
            BackendCredential.Bearer("new")
        }

        val result = factory.create("https://api.example.com", BackendCredential.Bearer("old")).get("/resource")

        assertEquals(AuthenticatedHttpResult.Success("ok"), result)
        assertEquals(
            listOf<BackendCredential>(BackendCredential.Bearer("old"), BackendCredential.Bearer("new")),
            attempts,
        )
        assertEquals(1, refreshes)
    }

    @Test
    fun forbiddenAndPatNeverRefresh() = runTest {
        val attempts = mutableListOf<BackendCredential>()
        var refreshes = 0
        val factory = factory(attempts) {
            refreshes += 1
            BackendCredential.Bearer("new")
        }

        val forbidden = factory.create(
            "https://api.example.com",
            BackendCredential.Bearer("forbidden"),
        ).get("/resource")
        val keyFailure = factory.create(
            "https://api.example.com",
            BackendCredential.PersonalAccessToken("key"),
        ).get("/resource")

        assertEquals(403, (forbidden as AuthenticatedHttpResult.Failure).statusCode)
        assertEquals(401, (keyFailure as AuthenticatedHttpResult.Failure).statusCode)
        assertEquals(0, refreshes)
        assertEquals(2, attempts.size)
    }

    @Test
    fun patFailuresNeverRetryOrDeleteOAuthSessionForAnyRequestBody() = runTest {
        for (secret in listOf("invalid", "forbidden")) {
            val attempts = mutableListOf<BackendCredential>()
            val deleted = mutableListOf<String>()
            val factory = factory(attempts, deleted) { error("PAT must not refresh OAuth") }
            val client = factory.create("https://api.example.com", BackendCredential.PersonalAccessToken(secret))
            val expected = if (secret == "forbidden") 403 else 401
            assertEquals(expected, (client.get("/resource") as AuthenticatedHttpResult.Failure).statusCode)
            assertEquals(expected, (client.post("/resource", "{}") as AuthenticatedHttpResult.Failure).statusCode)
            assertEquals(
                expected,
                client.postMultipart(
                    "/upload",
                    MultipartFile("f", "f.gz", "application/gzip", byteArrayOf(1)),
                ).statusCode,
            )
            assertEquals(3, attempts.size)
            assertEquals(emptyList(), deleted)
        }
    }

    @Test
    fun multipartUsesSameBearerRetry() = runTest {
        val attempts = mutableListOf<BackendCredential>()
        val factory = factory(attempts) { BackendCredential.Bearer("new") }

        val result = factory.create("https://api.example.com", BackendCredential.Bearer("old"))
            .postMultipart("/upload", MultipartFile("bundle", "bundle.gz", "application/gzip", byteArrayOf(1)))

        assertEquals(200, result.statusCode)
        assertEquals(
            listOf<BackendCredential>(BackendCredential.Bearer("old"), BackendCredential.Bearer("new")),
            attempts,
        )
    }

    @Test
    fun secondUnauthorizedDeletesOnlyUserSession() = runTest {
        val attempts = mutableListOf<BackendCredential>()
        val deleted = mutableListOf<String>()
        val factory = factory(attempts, deleted = deleted, alwaysUnauthorized = true) {
            BackendCredential.Bearer("new")
        }

        val result = factory.create("https://api.example.com", BackendCredential.Bearer("old")).get("/resource")

        assertEquals(401, (result as AuthenticatedHttpResult.Failure).statusCode)
        assertEquals(2, attempts.size)
        assertEquals(listOf("https://api.example.com"), deleted)
    }

    @Test
    fun mutationRefreshKeepsTheOriginalRequestAndIdempotencyKey() = runTest {
        val attempts = mutableListOf<BackendCredential>()
        val commands = mutableListOf<HttpMutationRequest>()
        val factory = factory(attempts, mutations = commands) { BackendCredential.Bearer("new") }
        val request = HttpMutationRequest(MutationHttpMethod.DELETE, "/resource", "{}", "original-key", 7)
        val result = factory.create("https://api.example.com", BackendCredential.Bearer("old")).mutate(request)
        assertEquals(200, (result as HttpMutationResult.Response).statusCode)
        assertEquals(listOf(request, request), commands)
        assertEquals(2, attempts.size)
    }

    private fun factory(
        attempts: MutableList<BackendCredential>,
        deleted: MutableList<String> = mutableListOf(),
        alwaysUnauthorized: Boolean = false,
        mutations: MutableList<HttpMutationRequest> = mutableListOf(),
        refresh: () -> BackendCredential.Bearer,
    ): AuthenticatedHttpClientFactory {
        val delegate = object : AuthenticatedHttpClientFactory {
            override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                create(apiUrl, BackendCredential.PersonalAccessToken(apiKey))

            override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
                object : AuthenticatedHttpClient {
                    override suspend fun get(path: String): AuthenticatedHttpResult {
                        attempts += credential
                        return if (alwaysUnauthorized) {
                            AuthenticatedHttpResult.Failure("Unauthorized", 401)
                        } else {
                            result(credential)
                        }
                    }

                    override suspend fun mutate(request: HttpMutationRequest): HttpMutationResult {
                        mutations += request
                        return when (val result = get(request.path)) {
                            is AuthenticatedHttpResult.Success -> HttpMutationResult.Response(
                                200,
                                result.body,
                                emptyMap(),
                                true,
                            )
                            is AuthenticatedHttpResult.Failure -> HttpMutationResult.Response(
                                result.statusCode ?: 503,
                                "",
                                emptyMap(),
                                true,
                            )
                        }
                    }

                    override suspend fun post(path: String, body: String): AuthenticatedHttpResult = get(path)

                    override suspend fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse {
                        attempts += credential
                        return AuthenticatedHttpResponse(
                            when (credential) {
                                BackendCredential.Bearer("new") -> 200
                                BackendCredential.PersonalAccessToken("forbidden") -> 403
                                else -> 401
                            },
                            "",
                        )
                    }
                }
        }
        val provider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = error("Policy must be explicit")

            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
                policy: CredentialPolicy,
            ): CredentialResult {
                assertEquals(CredentialPolicy.USER_SESSION, policy)
                return CredentialResult.Selected(refresh(), BackendCredentialType.USER_SESSION)
            }
        }
        val store = object : CredentialStore {
            override suspend fun read(apiUrl: String): UserSession? = null
            override suspend fun save(session: UserSession) = Unit
            override suspend fun delete(apiUrl: String) { deleted += apiUrl }
        }
        return RefreshingAuthenticatedHttpClientFactory(delegate, provider, store)
    }

    private fun result(credential: BackendCredential): AuthenticatedHttpResult = when (credential) {
        BackendCredential.Bearer("new") -> AuthenticatedHttpResult.Success("ok")
        BackendCredential.Bearer(
            "forbidden",
        ), BackendCredential.PersonalAccessToken("forbidden"),
        -> AuthenticatedHttpResult.Failure("Forbidden", 403)
        else -> AuthenticatedHttpResult.Failure("Unauthorized", 401)
    }
}
