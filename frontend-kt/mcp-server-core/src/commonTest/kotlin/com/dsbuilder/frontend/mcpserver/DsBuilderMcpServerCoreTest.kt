package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.CodeBindingGetCommand
import com.dsbuilder.frontend.feature.docs.application.CodeBindingSearchCommand
import com.dsbuilder.frontend.feature.docs.application.DocsReadErrorCode
import com.dsbuilder.frontend.feature.docs.application.DocsReadRemoteSource
import com.dsbuilder.frontend.feature.docs.application.DocsReadResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadRuntime
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocumentationFetchCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPageCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.theme.application.TokenGetReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenListReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenReadRemoteSource
import com.dsbuilder.frontend.feature.theme.application.TokenReadResult
import com.dsbuilder.frontend.feature.theme.application.TokenReadRuntime
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.feature.theme.application.TokenValuesReadCommand
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DsBuilderMcpServerCoreTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val context = ProjectContext(
        projectId = ProjectId("project-1"),
        designSystemId = DesignSystemId("ds-1"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/workspace/.sdds/config.json",
    )

    @Test
    fun listsToolsWithoutResolvingCredentials() {
        val server = server()

        val tools = server.tools()

        assertEquals(
            listOf(
                "design_system_get_context",
                "project_get_status",
                "documentation_search",
                "documentation_fetch",
                "documentation_get_navigation",
                "documentation_get_page",
                "code_binding_search",
                "code_binding_get",
                "tokens_list",
                "token_get",
                "token_values_get",
                "components_list",
                "component_get",
                "component_config_get",
                "component_styles_get",
                "component_variations_get",
            ),
            tools.map { it.name },
        )
        assertFalse(
            tools.any { it.name.contains("create") || it.name.contains("update") || it.name.contains("delete") },
        )
    }

    @Test
    fun designSystemContextReturnsStableBodyWithoutSecrets() = runTest {
        val server = server()

        val result = server.callTool("design_system_get_context")
        val body = json.parseToJsonElement(result.body).jsonObject

        assertFalse(result.isError)
        assertEquals("project-1", body.getValue("projectId").jsonPrimitive.content)
        assertEquals("ds-1", body.getValue("designSystemId").jsonPrimitive.content)
        assertEquals("/workspace/.sdds/config.json", body.getValue("configPath").jsonPrimitive.content)
        assertEquals("https://api.example.com", body.getValue("apiUrl").jsonPrimitive.content)
        assertEquals(JsonNull, body.getValue("credentialType"))
        assertFalse(result.body.contains("secret-value"))
    }

    @Test
    fun mapsContextAndAuthFailuresToErrorDto() = runTest {
        val contextError = server(
            contextResolver = ContextResolver(
                listOf(
                    object : ContextSource {
                        override fun resolve(startingDirectory: String?): ContextSourceResult =
                            ContextSourceResult.NotFound
                    },
                ),
            ),
        ).callTool("design_system_get_context")

        assertErrorCode("CONTEXT_NOT_FOUND", contextError)
    }

    @Test
    fun designSystemContextDoesNotRequireCredentials() = runTest {
        val server = server()

        val result = server.callTool("design_system_get_context")
        val body = json.parseToJsonElement(result.body).jsonObject

        assertFalse(result.isError)
        assertEquals("project-1", body.getValue("projectId").jsonPrimitive.content)
        assertEquals("ds-1", body.getValue("designSystemId").jsonPrimitive.content)
    }

    @Test
    fun projectStatusUsesStatusReaderWorkspaceAndMapsDomainErrors() = runTest {
        val server = server(
            config = McpServerConfig(apiUrlOverride = "https://api.example.com", workspace = "/chosen/workspace"),
            projectStatusReader = object : McpProjectStatusReader {
                override suspend fun read(
                    apiKeyOverride: String?,
                    apiUrlOverride: String?,
                    workspace: String?,
                ): CheckProjectStatusResult {
                    assertEquals("https://api.example.com", apiUrlOverride)
                    assertEquals("/chosen/workspace", workspace)
                    return CheckProjectStatusResult.Failed(
                        message = "Status: forbidden. API key has no access to this project.",
                        code = CheckProjectStatusErrorCode.FORBIDDEN,
                    )
                }
            },
        )

        assertErrorCode("FORBIDDEN", server.callTool("project_get_status"))
    }

    @Test
    fun projectStatusMapsMissingCredentialsToAuthRequired() = runTest {
        val server = server(
            projectStatusReader = object : McpProjectStatusReader {
                override suspend fun read(
                    apiKeyOverride: String?,
                    apiUrlOverride: String?,
                    workspace: String?,
                ): CheckProjectStatusResult = CheckProjectStatusResult.Failed(
                    message = "Error: authentication is required.",
                    code = CheckProjectStatusErrorCode.AUTH_REQUIRED,
                )
            },
        )

        assertErrorCode("AUTH_REQUIRED", server.callTool("project_get_status"))
    }

    @Test
    fun unknownToolReturnsProtocolError() = runTest {
        assertErrorCode("PROTOCOL_ERROR", server().callTool("missing_tool"))
    }

    @Test
    fun readToolsValidateRequiredArgumentsWithoutResolvingCredentials() = runTest {
        assertErrorCode("INVALID_ARGUMENT", server().callTool("token_get"))
        assertErrorCode("INVALID_ARGUMENT", server().callTool("component_get"))
        assertErrorCode("INVALID_ARGUMENT", server().callTool("documentation_search"))
    }

    @Test
    fun tokenListCallsApplicationUseCaseAndAppliesLocalLimit() = runTest {
        var called = false
        val server = server(
            tokenReadUseCases = tokenReadUseCases(
                object : TokenReadRemoteSource {
                    override suspend fun list(
                        runtime: TokenReadRuntime,
                        command: TokenListReadCommand,
                    ): TokenReadResult {
                        called = true
                        assertEquals("project-1", runtime.context.projectId.value)
                        assertEquals("button", command.query)
                        return TokenReadResult.Success(
                            JsonObject(
                                mapOf(
                                    "source" to JsonPrimitive("design-system-model-api"),
                                    "data" to JsonArray(
                                        listOf(
                                            JsonObject(mapOf("name" to JsonPrimitive("a"))),
                                            JsonObject(mapOf("name" to JsonPrimitive("b"))),
                                        ),
                                    ),
                                ),
                            ),
                        )
                    }

                    override suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult =
                        error("Unexpected token get")

                    override suspend fun values(
                        runtime: TokenReadRuntime,
                        command: TokenValuesReadCommand,
                    ): TokenReadResult = error("Unexpected token values")
                },
            ),
        )

        val result = server.callTool(
            "tokens_list",
            JsonObject(mapOf("query" to JsonPrimitive("button"), "limit" to JsonPrimitive("1"))),
        )
        val body = json.parseToJsonElement(result.body).jsonObject

        assertTrue(called)
        assertFalse(result.isError)
        assertEquals(1, (body.getValue("data") as JsonArray).size)
        assertFalse(result.body.contains("secret-value"))
    }

    @Test
    fun backendErrorsMapToStableMcpCodesWithoutStackTraces() = runTest {
        val server = server(
            docsReadUseCases = docsReadUseCases(
                object : DocsReadRemoteSource {
                    override suspend fun search(
                        runtime: DocsReadRuntime,
                        command: DocumentationSearchCommand,
                    ): DocsReadResult = DocsReadResult.Failed(
                        DocsReadErrorCode.PUBLICATION_NOT_FOUND,
                        "Active documentation publication was not found.",
                    )

                    override suspend fun fetch(
                        runtime: DocsReadRuntime,
                        command: DocumentationFetchCommand,
                    ): DocsReadResult = error("Unexpected docs fetch")

                    override suspend fun navigation(
                        runtime: DocsReadRuntime,
                        command: DocumentationPublicationCommand,
                    ): DocsReadResult = error("Unexpected docs navigation")

                    override suspend fun page(
                        runtime: DocsReadRuntime,
                        command: DocumentationPageCommand,
                    ): DocsReadResult = error("Unexpected docs page")

                    override suspend fun searchBindings(
                        runtime: DocsReadRuntime,
                        command: CodeBindingSearchCommand,
                    ): DocsReadResult = error("Unexpected binding search")

                    override suspend fun getBinding(
                        runtime: DocsReadRuntime,
                        command: CodeBindingGetCommand,
                    ): DocsReadResult = error("Unexpected binding get")
                },
            ),
        )

        val result = server.callTool("documentation_search", JsonObject(mapOf("query" to JsonPrimitive("button"))))

        assertErrorCode("PUBLICATION_NOT_FOUND", result)
        assertFalse(result.body.contains("Exception"))
        assertFalse(result.body.contains("secret-value"))
    }

    private fun server(
        contextResolver: ContextResolver = ContextResolver(
            listOf(
                object : ContextSource {
                    override fun resolve(startingDirectory: String?): ContextSourceResult =
                        ContextSourceResult.Found(context)
                },
            ),
        ),
        projectStatusReader: McpProjectStatusReader = object : McpProjectStatusReader {
            override suspend fun read(
                apiKeyOverride: String?,
                apiUrlOverride: String?,
                workspace: String?,
            ): CheckProjectStatusResult =
                CheckProjectStatusResult.Authorized(
                    projectName = "Project 1",
                    designSystemName = "DS 1",
                    configPath = "/workspace/.sdds/config.json",
                    apiUrl = "https://api.example.com",
                )
        },
        config: McpServerConfig = McpServerConfig(apiUrlOverride = "https://api.example.com"),
        docsReadUseCases: DocsReadUseCases? = null,
        tokenReadUseCases: TokenReadUseCases? = null,
        componentReadUseCases: ComponentReadUseCases? = null,
    ): DsBuilderMcpServerCore = DsBuilderMcpServerCore(
        config = config,
        contextResolver = contextResolver,
        apiUrlResolver = ApiUrlResolver(
            object : EnvironmentReader {
                override fun get(name: String): String? = null
            },
        ),
        projectStatusReader = projectStatusReader,
        docsReadUseCases = docsReadUseCases,
        tokenReadUseCases = tokenReadUseCases,
        componentReadUseCases = componentReadUseCases,
    )

    private fun tokenReadUseCases(remoteSource: TokenReadRemoteSource): TokenReadUseCases =
        TokenReadUseCases(contextResolver(), apiUrlResolver(), credentialProvider(), remoteSource)

    private fun docsReadUseCases(remoteSource: DocsReadRemoteSource): DocsReadUseCases =
        DocsReadUseCases(contextResolver(), apiUrlResolver(), credentialProvider(), remoteSource)

    @Suppress("unused")
    private fun componentReadUseCases(remoteSource: ComponentReadRemoteSource): ComponentReadUseCases =
        ComponentReadUseCases(contextResolver(), apiUrlResolver(), credentialProvider(), remoteSource)

    private fun contextResolver(): ContextResolver = ContextResolver(
        listOf(
            object : ContextSource {
                override fun resolve(startingDirectory: String?): ContextSourceResult =
                    ContextSourceResult.Found(context)
            },
        ),
    )

    private fun apiUrlResolver(): ApiUrlResolver = ApiUrlResolver(
        object : EnvironmentReader {
            override fun get(name: String): String? = null
        },
    )

    private fun credentialProvider(): CredentialProvider =
        object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult =
                CredentialResult.Selected(
                    credential = BackendCredential.ProjectKey("secret-value"),
                    type = com.dsbuilder.frontend.core.auth.BackendCredentialType.PROJECT_KEY,
                )
        }

    private fun assertErrorCode(expected: String, result: McpToolResult) {
        assertTrue(result.isError)
        val body = json.parseToJsonElement(result.body).jsonObject
        assertEquals(expected, body.getValue("code").jsonPrimitive.content)
    }
}
