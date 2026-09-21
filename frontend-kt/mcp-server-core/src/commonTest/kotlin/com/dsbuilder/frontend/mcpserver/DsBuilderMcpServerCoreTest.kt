package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectEnvironmentLoader
import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentListReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
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
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DsBuilderMcpServerCoreTest {
    @Test
    fun tokenToolUsesProjectEnvKeyAndProcessOverride() = runTest {
        val fileSystem = McpEnvFileSystem("DSBUILDER_API_KEY=file-secret\nDSBUILDER_API_URL=https://project.test")
        val resolver = ContextResolver(
            listOf(ContextSource { ContextSourceResult.Found(context) }),
            ProjectEnvironmentLoader(fileSystem),
        )
        var processKey: String? = null
        val process = EnvironmentReader { name -> processKey.takeIf { name == "DSBUILDER_API_KEY" } }
        val keyResolver = ApiKeyResolver(process)
        val credentials = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = error("request overload expected")

            override suspend fun resolve(request: CredentialRequest): CredentialResult {
                val key = keyResolver.resolve(
                    request.projectKeyOverride,
                    request.credentialEnvName.value,
                    request.projectEnvironment,
                )
                return CredentialResult.Selected(
                    BackendCredential.ProjectKey(key.value),
                    BackendCredentialType.PROJECT_KEY,
                )
            }
        }
        val used = mutableListOf<Pair<String, BackendCredential>>()
        val reads = TokenReadUseCases(
            resolver,
            ApiUrlResolver(process),
            credentials,
            object : TokenReadRemoteSource {
                override suspend fun list(runtime: TokenReadRuntime, command: TokenListReadCommand): TokenReadResult {
                    used += runtime.apiUrl.value to runtime.credential
                    return TokenReadResult.Success(JsonObject(emptyMap()))
                }
                override suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult =
                    error("not called")
                override suspend fun values(
                    runtime: TokenReadRuntime,
                    command: TokenValuesReadCommand,
                ): TokenReadResult =
                    error("not called")
            },
        )
        val mcp = server(
            contextResolver = resolver,
            config = McpServerConfig(workspace = "/workspace"),
            tokenReadUseCases = reads,
        )
        val first = mcp.callTool("tokens_list")
        processKey = "process-secret"
        val second = mcp.callTool("tokens_list")

        assertFalse(first.isError, first.body)
        assertFalse(second.isError, second.body)
        assertEquals("https://project.test", used[0].first)
        assertEquals(BackendCredential.ProjectKey("file-secret"), used[0].second)
        assertEquals(BackendCredential.ProjectKey("process-secret"), used[1].second)
        assertFalse(first.body.contains("file-secret"))
        assertFalse(second.body.contains("process-secret"))
    }

    @Test
    fun localContextToolReloadsProjectApiUrlWithoutLeakingEnv() = runTest {
        val fileSystem = McpEnvFileSystem("DSBUILDER_API_URL=https://first.test\nPROJECT_KEY=secret-value")
        val resolver = ContextResolver(
            listOf(ContextSource { ContextSourceResult.Found(context) }),
            ProjectEnvironmentLoader(fileSystem),
        )
        val mcp = server(contextResolver = resolver, config = McpServerConfig(workspace = "/workspace"))
        val first = mcp.callTool("design_system_get_context")
        assertEquals(
            "https://first.test",
            json.parseToJsonElement(first.body).jsonObject.getValue("apiUrl").jsonPrimitive.content,
        )
        assertFalse(first.body.contains("secret-value"))

        fileSystem.content = "DSBUILDER_API_URL=https://second.test\nPROJECT_KEY=next-secret"
        val second = mcp.callTool("design_system_get_context")
        assertEquals(
            "https://second.test",
            json.parseToJsonElement(second.body).jsonObject.getValue("apiUrl").jsonPrimitive.content,
        )
        assertFalse(second.body.contains("next-secret"))
        val link = "dsbuilder://projects/project-b/design-systems/ds-b?version=1&platform=compose"
        val explicit = mcp.callTool(
            "design_system_get_context",
            JsonObject(mapOf("designSystem" to JsonPrimitive(link))),
        )
        assertFalse(explicit.body.contains("https://second.test"))
    }

    @Test
    fun explicitLinksAreIsolatedPerToolCall() = runTest {
        val server = server()
        val first = server.callTool(
            "design_system_get_context",
            JsonObject(
                mapOf(
                    "designSystem" to JsonPrimitive(
                        "dsbuilder://projects/project-a/design-systems/ds-a?version=1.0.0&platform=compose",
                    ),
                ),
            ),
        )
        val second = server.callTool(
            "design_system_get_context",
            JsonObject(
                mapOf(
                    "designSystem" to JsonPrimitive(
                        "dsbuilder://projects/project-b/design-systems/ds-b?version=2.0.0&platform=swiftui",
                    ),
                ),
            ),
        )
        val local = server.callTool("design_system_get_context")

        assertEquals(
            "project-a",
            json.parseToJsonElement(first.body).jsonObject.getValue("projectId").jsonPrimitive.content,
        )
        assertEquals(
            "project-b",
            json.parseToJsonElement(second.body).jsonObject.getValue("projectId").jsonPrimitive.content,
        )
        assertEquals(
            "project-1",
            json.parseToJsonElement(local.body).jsonObject.getValue("projectId").jsonPrimitive.content,
        )
        assertEquals(
            "explicit-link",
            json.parseToJsonElement(first.body).jsonObject.getValue("provenance").jsonPrimitive.content,
        )
    }

    @Test
    fun tokenReadUsesEachCallsExplicitProject() = runTest {
        val projects = mutableListOf<String>()
        val reads = tokenReadUseCases(
            object : TokenReadRemoteSource {
                override suspend fun list(
                    runtime: TokenReadRuntime,
                    command: TokenListReadCommand,
                ): TokenReadResult {
                    projects += runtime.context.projectId.value
                    return TokenReadResult.Success(JsonObject(emptyMap()))
                }
                override suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult =
                    error("not called")
                override suspend fun values(
                    runtime: TokenReadRuntime,
                    command: TokenValuesReadCommand,
                ): TokenReadResult =
                    error("not called")
            },
        )
        val server = server(tokenReadUseCases = reads)
        listOf("project-a" to "ds-a", "project-b" to "ds-b").forEach { (project, ds) ->
            val result = server.callTool(
                "tokens_list",
                JsonObject(
                    mapOf(
                        "designSystem" to JsonPrimitive(
                            "dsbuilder://projects/$project/design-systems/$ds?version=1.0.0&platform=compose",
                        ),
                    ),
                ),
            )
            assertFalse(result.isError, result.body)
        }
        assertEquals(listOf("project-a", "project-b"), projects)
    }

    @Test
    fun invalidExplicitLinkNeverUsesLocalContext() = runTest {
        val result = server().callTool(
            "design_system_get_context",
            JsonObject(mapOf("designSystem" to JsonPrimitive("dsbuilder://projects/a/design-systems/b?version=1"))),
        )
        assertErrorCode("INVALID_CONTEXT", result)
    }

    @Test
    fun tokenRefreshBackendFailureIsNotReportedAsAuthRequired() = runTest {
        val provider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = CredentialResult.Failed(
                AuthErrorCode.BACKEND_UNAVAILABLE,
                "Token endpoint unavailable",
            )
        }
        val remote = object : TokenReadRemoteSource {
            override suspend fun list(runtime: TokenReadRuntime, command: TokenListReadCommand): TokenReadResult =
                error("Backend must not be called")

            override suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult =
                error("Backend must not be called")

            override suspend fun values(runtime: TokenReadRuntime, command: TokenValuesReadCommand): TokenReadResult =
                error("Backend must not be called")
        }
        val cases = TokenReadUseCases(contextResolver(), apiUrlResolver(), provider, remote)

        assertErrorCode("BACKEND_UNAVAILABLE", server(tokenReadUseCases = cases).callTool("tokens_list"))
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val context = ProjectContext(
        projectId = ProjectId("project-1"),
        designSystemId = DesignSystemId("ds-1"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/workspace/.sdds/config.json",
        platforms = listOf(TargetPlatform.COMPOSE),
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
    fun codeBindingSearchContractDistinguishesCanonicalSubjectFromCodeName() {
        val tool = server().tools().single { it.name == "code_binding_search" }

        assertTrue(tool.description.contains("compact metadata"))
        assertTrue(tool.description.contains("code_binding_get with detail=summary"))
        assertTrue(tool.description.contains("Do not call components_list or component_variations_get"))
        assertTrue(tool.description.contains("Use name for a code symbol such as BasicButton"))
        assertTrue(tool.inputSchema.getValue("subject").description!!.contains("components.basic-button"))
        assertTrue(tool.inputSchema.getValue("name").description!!.contains("BasicButton"))
        assertEquals(
            listOf("component-style", "token"),
            tool.inputSchema.getValue("kind").allowedValues,
        )
        assertEquals("integer", tool.inputSchema.getValue("limit").type)
    }

    @Test
    fun codeBindingGetContractExposesOpaqueNameFilters() {
        val tool = server().tools().single { it.name == "code_binding_get" }
        val schema = tool.inputSchema

        assertTrue(tool.description.contains("after code_binding_search"))
        assertTrue(tool.description.contains("configuration model instead"))
        assertEquals("array", schema.getValue("appearanceNames").type)
        assertEquals("string", schema.getValue("appearanceNames").itemType)
        assertEquals("array", schema.getValue("variationNames").type)
        assertEquals("string", schema.getValue("variationNames").itemType)
        assertEquals(listOf("summary", "variations", "full"), schema.getValue("detail").allowedValues)
        assertTrue(schema.getValue("appearanceNames").description!!.contains("styleName"))
        assertTrue(schema.getValue("variationNames").description!!.contains("exact variation name"))
    }

    @Test
    fun codeBindingGetRejectsNonStringFilterValues() = runTest {
        val result = server().callTool(
            "code_binding_get",
            JsonObject(
                mapOf(
                    "bindingId" to JsonPrimitive("binding-1"),
                    "appearanceNames" to JsonArray(listOf(JsonPrimitive(1))),
                ),
            ),
        )

        assertErrorCode("INVALID_ARGUMENT", result)
    }

    @Test
    fun componentConfigContractExplainsHowToContinueFromCodeBinding() {
        val tools = server().tools()
        val config = tools.single { it.name == "component_config_get" }
        val values = tools.single { it.name == "token_values_get" }
        val tokens = tools.single { it.name == "tokens_list" }
        val token = tools.single { it.name == "token_get" }
        val component = tools.single { it.name == "component_get" }
        val componentStyles = tools.single { it.name == "component_styles_get" }
        val componentVariations = tools.single { it.name == "component_variations_get" }
        val components = tools.single { it.name == "components_list" }

        assertTrue(config.description.contains("BasicButton.S.Accent"))
        assertTrue(config.inputSchema.getValue("subject").description!!.contains("components.basic-button"))
        assertTrue(config.inputSchema.getValue("style").description!!.contains("S.Accent"))
        assertTrue(config.inputSchema.getValue("selection").description!!.contains("size=s,view=accent"))
        assertEquals(listOf("full", "token-references"), config.inputSchema.getValue("projection").allowedValues)
        assertEquals(listOf("light", "dark"), values.inputSchema.getValue("mode").allowedValues)
        assertEquals(listOf("web", "android", "ios"), values.inputSchema.getValue("platform").allowedValues)
        assertTrue(values.inputSchema.getValue("platform").description!!.contains("android for Compose"))
        assertTrue(tokens.description.contains("queries such as BasicButton or button may be empty"))
        assertTrue(components.description.contains("code_binding_get with detail=summary"))
        assertTrue(componentVariations.description.contains("published code variations"))
        assertTrue(tokens.inputSchema.containsKey("name"))
        assertTrue(components.inputSchema.containsKey("name"))
        assertTrue(components.inputSchema.containsKey("platform"))
        assertFalse(config.inputSchema.containsKey("componentId"))
        assertFalse(token.inputSchema.containsKey("name"))
        assertFalse(values.inputSchema.containsKey("name"))
        assertFalse(component.inputSchema.containsKey("name"))
        assertFalse(componentStyles.inputSchema.containsKey("name"))
        assertFalse(componentVariations.inputSchema.containsKey("name"))
    }

    @Test
    fun documentationSearchExposesImplementedFilters() {
        val schema = server().tools().single { it.name == "documentation_search" }.inputSchema

        assertTrue(schema.keys.containsAll(listOf("query", "subject", "limit", "cursor", "version", "platform")))
        assertEquals("integer", schema.getValue("limit").type)
    }

    @Test
    fun componentConfigAcceptsCanonicalCodeBindingSubject() = runTest {
        var captured: ComponentConfigReadCommand? = null
        val server = server(
            componentReadUseCases = componentReadUseCases(
                object : ComponentReadRemoteSource {
                    override suspend fun list(
                        runtime: ComponentReadRuntime,
                        command: ComponentListReadCommand,
                    ): ComponentReadResult = error("Unexpected component list")

                    override suspend fun get(
                        runtime: ComponentReadRuntime,
                        command: ComponentGetReadCommand,
                    ): ComponentReadResult = error("Unexpected component get")

                    override suspend fun config(
                        runtime: ComponentReadRuntime,
                        command: ComponentConfigReadCommand,
                    ): ComponentReadResult {
                        captured = command
                        return ComponentReadResult.Success(JsonObject(emptyMap()))
                    }

                    override suspend fun styles(
                        runtime: ComponentReadRuntime,
                        command: ComponentGetReadCommand,
                    ): ComponentReadResult = error("Unexpected component styles")

                    override suspend fun variations(
                        runtime: ComponentReadRuntime,
                        command: ComponentGetReadCommand,
                    ): ComponentReadResult = error("Unexpected component variations")

                    override suspend fun tokens(runtime: ComponentReadRuntime): ComponentReadResult =
                        error("Unexpected token catalog")
                },
            ),
        )

        val result = server.callTool(
            "component_config_get",
            JsonObject(mapOf("subject" to JsonPrimitive("components.basic-button"))),
        )

        assertFalse(result.isError)
        assertEquals(ComponentConfigReadCommand("basic-button", null), captured)
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

        assertErrorCode("CONTEXT_REQUIRED", contextError)
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
    fun listToolsRejectCombiningExactNameAndSubstringQuery() = runTest {
        val arguments = JsonObject(
            mapOf(
                "name" to JsonPrimitive("badge"),
                "query" to JsonPrimitive("bad"),
            ),
        )

        assertErrorCode("INVALID_ARGUMENT", server().callTool("tokens_list", arguments))
        assertErrorCode("INVALID_ARGUMENT", server().callTool("components_list", arguments))
    }

    @Test
    fun tokenListUsesExactNameAsBackendQueryAndReturnsCompactResult() = runTest {
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
                        assertEquals("b", command.query)
                        return TokenReadResult.Success(
                            JsonObject(
                                mapOf(
                                    "source" to JsonPrimitive("design-system-model-api"),
                                    "data" to JsonArray(
                                        listOf(
                                            JsonObject(
                                                mapOf(
                                                    "id" to JsonPrimitive("a-id"),
                                                    "name" to JsonPrimitive("a"),
                                                    "type" to JsonPrimitive("color"),
                                                    "createdAt" to JsonPrimitive("now"),
                                                ),
                                            ),
                                            JsonObject(
                                                mapOf(
                                                    "id" to JsonPrimitive("b-id"),
                                                    "name" to JsonPrimitive("b"),
                                                    "type" to JsonPrimitive("color"),
                                                    "createdAt" to JsonPrimitive("now"),
                                                ),
                                            ),
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
            JsonObject(mapOf("name" to JsonPrimitive("b"), "limit" to JsonPrimitive("1"))),
        )
        val body = json.parseToJsonElement(result.body).jsonObject
        val token = (body.getValue("data") as JsonArray).single().jsonObject

        assertTrue(called)
        assertFalse(result.isError)
        assertEquals("b", token.getValue("name").jsonPrimitive.content)
        assertFalse(token.containsKey("createdAt"))
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

            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
                policy: CredentialPolicy,
            ): CredentialResult = if (policy == CredentialPolicy.USER_SESSION) {
                CredentialResult.Selected(
                    BackendCredential.Bearer("access-token"),
                    com.dsbuilder.frontend.core.auth.BackendCredentialType.USER_SESSION,
                )
            } else {
                resolve(apiUrl, projectKeyOverride, credentialEnvName)
            }
        }

    private fun assertErrorCode(expected: String, result: McpToolResult) {
        assertTrue(result.isError)
        val body = json.parseToJsonElement(result.body).jsonObject
        assertEquals(expected, body.getValue("code").jsonPrimitive.content)
    }
}

private class McpEnvFileSystem(var content: String) : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = "/workspace"
    override fun parent(path: String): String? = path.substringBeforeLast('/', "").ifEmpty { null }
    override fun resolve(parent: String, child: String): String = "$parent/$child"
    override fun absolutePath(path: String): String = path
    override fun exists(path: String): Boolean = path == "/workspace/.env"
    override fun createDirectories(path: String) = error("not used")
    override fun listFiles(path: String): List<String> = error("not used")
    override fun isDirectory(path: String): Boolean = false
    override fun readText(path: String): String = error("not used")
    override fun readBytes(path: String): ByteArray = content.encodeToByteArray()
    override fun writeText(path: String, text: String) = error("not used")
    override fun writeBytes(path: String, bytes: ByteArray) = error("not used")
    override fun sink(path: String): BufferedSink = error("not used")
    override fun deleteFile(path: String) = error("not used")
}
