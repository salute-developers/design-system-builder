package com.dsbuilder.frontend.feature.theme

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.theme.application.GetTokenCodeReferenceUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceClient
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceErrorCode
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.feature.theme.data.HttpTokenCodeReferenceClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

private const val PUBLICATION = """{"publicationId":"pub-1","version":"0.0.0"}"""

private fun binding(reference: String?): String {
    val ref = reference?.let { "\"$it\"" } ?: "null"
    return """{"items":[{"subject":"s","platformPayload":{"themeReference":$ref}}],"nextCursor":null}"""
}

class HttpTokenCodeReferenceClientTest {
    private val credential = BackendCredential.Bearer("token")

    private fun client(
        activeStatus: HttpStatusCode = HttpStatusCode.OK,
        bindings: Map<String, String>,
        requested: MutableList<String> = mutableListOf(),
    ): HttpTokenCodeReferenceClient {
        val engine = MockEngine { request ->
            val path = request.url.encodedPath + "?" + request.url.encodedQuery
            requested += path
            when {
                request.url.encodedPath.endsWith("/publications/active") -> respond(PUBLICATION, activeStatus)
                else -> {
                    val subject = request.url.parameters["subject"]
                    respond(bindings[subject] ?: """{"items":[],"nextCursor":null}""")
                }
            }
        }
        return HttpTokenCodeReferenceClient(KtorAuthenticatedHttpClientFactory { HttpClient(engine) })
    }

    private suspend fun HttpTokenCodeReferenceClient.lookup(vararg subjects: String) =
        themeReference("https://gw", credential, "p1", "ds1", "compose", subjects.toList())

    @Test
    fun returnsThemeReferenceOfFirstMatchingSubject() = runTest {
        val requested = mutableListOf<String>()
        val result = client(
            bindings = mapOf("tokens.light.text.default.accent" to binding("SddsServTheme.colors.textDefaultAccent")),
            requested = requested,
        ).lookup("tokens.light.text.default.accent", "tokens.text.default.accent")

        assertEquals(TokenCodeReferenceResult.Found("SddsServTheme.colors.textDefaultAccent"), result)
        assertEquals(2, requested.size) // active + один поиск биндинга
    }

    @Test
    fun fallsBackToModelessSubject() = runTest {
        val result = client(
            bindings = mapOf("tokens.spacing.4x" to binding("SddsServTheme.spacing.spacing4x")),
        ).lookup("tokens.light.spacing.4x", "tokens.spacing.4x")

        assertEquals(TokenCodeReferenceResult.Found("SddsServTheme.spacing.spacing4x"), result)
    }

    @Test
    fun notAvailableWhenNothingPublishedOrBound() = runTest {
        assertEquals(
            TokenCodeReferenceResult.NotAvailable,
            client(activeStatus = HttpStatusCode.NotFound, bindings = emptyMap()).lookup("tokens.a"),
        )
        assertEquals(TokenCodeReferenceResult.NotAvailable, client(bindings = emptyMap()).lookup("tokens.a"))
    }

    @Test
    fun nullThemeReferenceIsNotAvailable() = runTest {
        val result = client(bindings = mapOf("tokens.display" to binding("null"))).lookup("tokens.display")

        assertEquals(TokenCodeReferenceResult.NotAvailable, result)
    }

    @Test
    fun unauthorizedMapsToAuthRequired() = runTest {
        val result = client(activeStatus = HttpStatusCode.Unauthorized, bindings = emptyMap()).lookup("tokens.a")

        assertIs<TokenCodeReferenceResult.Failed>(result)
        assertEquals(TokenCodeReferenceErrorCode.AUTH_REQUIRED, result.code)
    }
}

private class NoOpStore : RefreshTokenStore {
    override fun save(refreshToken: String) = Unit

    override fun load(): String? = null

    override fun clear() = Unit
}

class GetTokenCodeReferenceUseCaseTest {
    private class RecordingClient : TokenCodeReferenceClient {
        var subjects: List<String> = emptyList()
        var platform: String = ""

        override suspend fun themeReference(
            apiUrl: String,
            credential: BackendCredential,
            projectId: String,
            designSystemId: String,
            platform: String,
            subjects: List<String>,
        ): TokenCodeReferenceResult {
            this.subjects = subjects
            this.platform = platform
            return TokenCodeReferenceResult.NotAvailable
        }
    }

    private fun session(withToken: Boolean) = UserSessionCredentialResolver(NoOpStore()).also {
        if (withToken) it.applyTokens(UserOAuthTokens("access", "refresh", 300))
    }

    @Test
    fun triesModeSubjectBeforeModelessAndDefaultsToCompose() = runTest {
        val client = RecordingClient()

        GetTokenCodeReferenceUseCase(ApiUrlResolver { null }, session(true), client)
            .execute("p1", "ds1", "text.default.accent", mode = "dark")

        assertEquals(listOf("tokens.dark.text.default.accent", "tokens.text.default.accent"), client.subjects)
        assertEquals("compose", client.platform)
    }

    @Test
    fun onlyModelessSubjectWithoutMode() = runTest {
        val client = RecordingClient()

        GetTokenCodeReferenceUseCase(ApiUrlResolver { null }, session(true), client)
            .execute("p1", "ds1", "spacing.4x", mode = null)

        assertEquals(listOf("tokens.spacing.4x"), client.subjects)
    }

    @Test
    fun missingSessionFailsWithAuthRequiredWithoutCallingClient() = runTest {
        val client = RecordingClient()

        val result = GetTokenCodeReferenceUseCase(ApiUrlResolver { null }, session(false), client)
            .execute("p1", "ds1", "spacing.4x", mode = null)

        assertIs<TokenCodeReferenceResult.Failed>(result)
        assertEquals(TokenCodeReferenceErrorCode.AUTH_REQUIRED, result.code)
        assertEquals(emptyList(), client.subjects)
    }
}
