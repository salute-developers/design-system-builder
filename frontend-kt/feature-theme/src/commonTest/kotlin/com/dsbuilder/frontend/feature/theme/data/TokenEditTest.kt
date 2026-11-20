package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.HttpMutationRequest
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.core.network.MutationHttpMethod
import com.dsbuilder.frontend.feature.theme.application.EditTokenUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenEditCommand
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

class TokenEditTest {
    @Test
    fun publishedContextRefusesWritingButExplicitDraftSelectsTheSameSystem() = runTest {
        val fixture = Fixture("1.0.0")
        val command = TokenEditCommand.DeleteDefinition("token")
        assertEquals(
            "READ_ONLY_VERSION",
            assertIs<DraftOperationResult.Failed>(fixture.useCase.execute(command, DraftEditOptions("key"))).code,
        )
        assertEquals(0, fixture.requests.size)
        fixture.useCase.execute(command, DraftEditOptions("key", version = "draft"))
        assertEquals("/api/projects/project/design-systems/system/tokens/token", fixture.requests.single().path)
        assertEquals(2, fixture.contextReads)
    }

    @Test
    fun updateKeepsTheValueKeyAndOriginalRevisionAcrossRetriesWithoutAGet() = runTest {
        val fixture = Fixture()
        val command = TokenEditCommand.UpdateValue("value", JsonPrimitive("palette.ref"), "palette")
        repeat(2) { fixture.useCase.execute(command, DraftEditOptions("original", baseRevision = 7)) }
        val request = fixture.requests.first()
        assertEquals(request, fixture.requests.last())
        assertEquals(MutationHttpMethod.PATCH, request.method)
        assertEquals("original", request.idempotencyKey)
        assertEquals(7L, request.baseRevision)
        val body = Json.parseToJsonElement(request.body!!).jsonObject
        assertEquals(setOf("value", "paletteId"), body.keys)
        assertEquals(JsonPrimitive("palette.ref"), body["value"])
        assertFalse("designSystemId" in body)
        assertEquals(2, fixture.contextReads)
    }

    @Test
    fun paletteOnlyUpdateOmitsValueAndKeepsOriginalRequestOnRetry() = runTest {
        val fixture = Fixture()
        val command = TokenEditCommand.UpdateValue("value", paletteId = "palette")
        repeat(2) { fixture.useCase.execute(command, DraftEditOptions("same-key", baseRevision = 7)) }
        assertEquals(fixture.requests.first(), fixture.requests.last())
        assertEquals("""{"paletteId":"palette"}""", fixture.requests.first().body)
    }

    @Test
    fun allPointOperationsHaveFixedTargetsAndDeleteHasNoBody() = runTest {
        val fixture = Fixture()
        val commands = listOf(
            TokenEditCommand.CreateDefinition("spacing.test"),
            TokenEditCommand.UpdateDefinition("token", enabled = false),
            TokenEditCommand.DeleteDefinition("token"),
            TokenEditCommand.CreateValue("token", "tenant", "web", "dark", JsonPrimitive(4)),
            TokenEditCommand.UpdateValue("value", JsonPrimitive(8)),
            TokenEditCommand.DeleteValue("value"),
        )
        for (command in commands) fixture.useCase.execute(command, DraftEditOptions("key"))
        assertEquals(
            listOf("POST", "PATCH", "DELETE", "POST", "PATCH", "DELETE"),
            fixture.requests.map { it.method.name },
        )
        assertEquals(
            listOf(
                "tokens",
                "tokens/token",
                "tokens/token",
                "token-values",
                "token-values/value",
                "token-values/value",
            ),
            fixture.requests.map { it.path.substringAfter("/system/") },
        )
        assertNull(fixture.requests[2].body)
        assertNull(fixture.requests[5].body)
    }

    @Test
    fun invalidKeyFailsBeforeRuntimeResolution() = runTest {
        val fixture = Fixture()
        assertIs<DraftOperationResult.Failed>(
            fixture.useCase.execute(TokenEditCommand.DeleteValue("value"), DraftEditOptions(" ")),
        )
        assertEquals(0, fixture.contextReads)
    }

    private class Fixture(version: String? = null) {
        val requests = mutableListOf<HttpMutationRequest>()
        var contextReads = 0
        private val context =
            ProjectContext(
                ProjectId("project"),
                DesignSystemId("system"),
                CredentialEnvName("KEY"),
                "",
                selectedVersion = version,
            )
        private val resolver = RuntimeRequestResolver(
            ContextResolver(
                listOf(
                    ContextSource {
                        contextReads++
                        ContextSourceResult.Found(context)
                    },
                ),
            ),
            ApiUrlResolver(object : EnvironmentReader { override fun get(name: String): String? = null }),
            object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult =
                    CredentialResult.Selected(
                        BackendCredential.PersonalAccessToken("key"),
                        com.dsbuilder.frontend.core.auth.BackendCredentialType.PERSONAL_ACCESS_TOKEN,
                    )
            },
        )
        private val factory = object : AuthenticatedHttpClientFactory {
            override fun create(
                apiUrl: String,
                apiKey: String,
            ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult = error("No pre-write GET")
                override suspend fun post(
                    path: String,
                    body: String,
                ): AuthenticatedHttpResult = error("Use mutation transport")
                override suspend fun mutate(request: HttpMutationRequest): HttpMutationResult {
                    requests += request
                    return HttpMutationResult.Response(200, "{}", emptyMap(), true)
                }
            }
        }
        val useCase = EditTokenUseCase(resolver, HttpTokenEditRemoteSource(factory))
    }
}
