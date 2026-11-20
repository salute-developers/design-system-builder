package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.UserSessionAccess
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.dsApplicationModule
import com.dsbuilder.frontend.feature.projects.projectsApplicationModule
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.koin.dsl.koinApplication
import org.koin.dsl.module
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class DiscoveryMcpToolsTest {
    private val id = "11111111-1111-1111-1111-111111111111"
    private fun server(active: Boolean = true, response: (String) -> AuthenticatedHttpResult): DsBuilderMcpServerCore {
        val session = UserSessionCredentialResolver(
            object : RefreshTokenStore {
                override fun save(refreshToken: String) = Unit
                override fun load(): String? = null
                override fun clear() = Unit
            },
        )
        if (active) session.applyTokens(UserOAuthTokens("fixture-access", "fixture-refresh", 300))
        val factory = object : AuthenticatedHttpClientFactory {
            override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = error("No project key")
            override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient {
                assertEquals("https://fixture.example", apiUrl)
                assertIs<BackendCredential.Bearer>(credential)
                return object : AuthenticatedHttpClient {
                    override suspend fun get(path: String) = response(path)
                    override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("No writes")
                }
            }
        }
        val dependencies = module {
            single { UserSessionAccess(session) }
            single { ApiUrlResolver { null } }
            single<AuthenticatedHttpClientFactory> { factory }
        }
        val koin = koinApplication {
            modules(dsApplicationModule(), projectsApplicationModule(), dependencies)
        }.koin
        return DsBuilderMcpServerCore(
            McpServerConfig(apiUrlOverride = "https://fixture.example", workspace = "/must-not-read"),
            McpProjectStatusReader { _, _, _ -> CheckProjectStatusResult.Authorized("p", "s", "", "") },
            listProjectsUseCase = koin.get(),
            listDesignSystemsUseCase = koin.get(),
            discoverVersionsUseCase = koin.get(),
        )
    }

    @Test
    fun sequentialDiscoveryNeedsNoWorkspaceAndDoesNotRememberSystem() = runTest {
        val paths = mutableListOf<String>()
        val core = server { path ->
            paths += path
            when {
                path == "/api/projects" -> AuthenticatedHttpResult.Success("""[{"id":"p","name":"Project"}]""")
                path.endsWith("/design-systems") -> AuthenticatedHttpResult.Success(
                    """[{"id":"$id","name":"System"}]""",
                )
                else -> AuthenticatedHttpResult.Success(
                    """[{"id":"version-id","designSystemId":"$id","version":"1.2.3"}]""",
                    mapOf(
                        "x-ds-read-context" to """{"designSystemId":"$id"}""",
                        "x-ds-page-limit" to "2",
                        "x-ds-next-cursor" to "next",
                    ),
                )
            }
        }
        assertFalse(core.callTool("projects_list").isError)
        assertFalse(core.callTool("design_systems_list", buildJsonObject { put("projectId", "p") }).isError)
        for (project in listOf("p", "other")) {
            val result = core.callTool(
                "design_system_versions_list",
                buildJsonObject {
                    put("projectId", project)
                    put("designSystemId", id)
                    put("limit", 2)
                    put("cursor", "previous")
                },
            )
            assertFalse(result.isError, result.body)
            assertTrue(result.body.contains("dsbuilder://projects/$project/design-systems/$id?version=1.2.3"))
            assertTrue(result.body.contains("nextCursor"))
        }
        assertEquals(4, paths.size)
        assertTrue(paths.last().startsWith("/api/projects/other/"))
    }

    @Test
    fun discoverySchemasAndArgumentValidationAreIndependentOfCredentials() = runTest {
        val core = server(false) { error("No request for invalid input") }
        val tools = core.tools().associateBy { it.name }
        assertTrue(tools.getValue("projects_list").inputSchema.isEmpty())
        assertEquals(setOf("projectId"), tools.getValue("design_systems_list").inputSchema.keys)
        assertTrue(tools.getValue("design_systems_list").inputSchema.getValue("projectId").required)
        val invalid = listOf(
            "projects_list" to buildJsonObject { put("unknown", "x") },
            "design_systems_list" to buildJsonObject { },
            "design_systems_list" to buildJsonObject { put("projectId", 1) },
            "design_system_versions_list" to buildJsonObject { put("projectId", "p") },
            "design_system_versions_list" to buildJsonObject { put("designSystemId", "s") },
            "design_system_versions_list" to buildJsonObject {
                put(
                    "projectId",
                    "p",
                )
                put(
                    "designSystemId",
                    "s",
                )
                put(
                    "designSystem",
                    "uri",
                )
            },
        )
        for ((name, arguments) in invalid) assertTrue(core.callTool(name, arguments).body.contains("INVALID_QUERY"))
        val missing = core.callTool("projects_list")
        assertTrue(missing.body.contains("AUTH_REQUIRED"))
        assertTrue(missing.body.contains("auth login"))
    }

    @Test
    fun emptyCatalogsAndBackendFailuresRemainStructured() = runTest {
        val empty = server { AuthenticatedHttpResult.Success("[]") }
        assertEquals("{\"items\":[]}", empty.callTool("projects_list").body)
        assertFalse(empty.callTool("design_systems_list", buildJsonObject { put("projectId", "p") }).isError)
        for ((
            status,
            code,
        ) in listOf(
            401 to "AUTH_REQUIRED",
            403 to "FORBIDDEN",
            404 to "NOT_FOUND",
            503 to "BACKEND_UNAVAILABLE",
        )) {
            val core = server { AuthenticatedHttpResult.Failure("fixture-secret", status) }
            for (name in listOf("projects_list", "design_systems_list")) {
                val result = core.callTool(
                    name,
                    if (name == "projects_list") {
                        JsonObject(emptyMap())
                    } else {
                        buildJsonObject {
                            put(
                                "projectId",
                                "p",
                            )
                        }
                    },
                )
                assertTrue(result.isError)
                assertTrue(result.body.contains(code))
                assertFalse(result.body.contains("fixture-secret"))
            }
        }
    }
}
