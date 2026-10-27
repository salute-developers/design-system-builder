package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectEnvironmentLoader
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
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
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
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
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.ds.dsApplicationModule
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okio.BufferedSink
import org.koin.dsl.koinApplication
import org.koin.dsl.module
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DsBuilderMcpServerCoreTest {
    @Test
    fun appearanceReadUsesExplicitIdAndVersionArgumentOverridesTheUri() = runTest {
        val paths = mutableListOf<String>()
        val core = server(
            modelReadUseCase = modelReader { _, _, path ->
                paths += path
                modelResponse(path).copy(body = "[]")
            },
        )
        val id = "550e8400-e29b-41d4-a716-446655440010"
        val link = "dsbuilder://projects/project-a/design-systems/" +
            "550e8400-e29b-41d4-a716-446655440000?version=1.0.0&platform=compose"
        val result = core.callTool(
            "component_variations_get",
            JsonObject(
                mapOf(
                    "appearanceId" to JsonPrimitive(id),
                    "version" to JsonPrimitive("draft"),
                    "designSystem" to JsonPrimitive(link),
                ),
            ),
        )
        assertFalse(result.isError, result.body)
        assertEquals("/api/projects/project-a/ds/appearances/$id/variations?version=draft", paths.single())
        assertErrorCode(
            "INVALID_QUERY",
            core.callTool(
                "component_variations_get",
                JsonObject(mapOf("componentId" to JsonPrimitive(id))),
            ),
        )
        assertEquals(1, paths.size)
        val tool = core.tools().single { it.name == "component_variations_get" }
        assertTrue(tool.inputSchema.getValue("appearanceId").required)
        assertFalse("componentId" in tool.inputSchema)
        assertFalse("version" in core.tools().single { it.name == "component_get" }.inputSchema)
    }

    @Test
    fun tokenToolUsesProjectEnvKeyAndProcessOverride() = runTest {
        val fileSystem = McpEnvFileSystem("DSBUILDER_API_KEY=file-secret\nDSBUILDER_API_URL=https://project.test")
        val resolver = ContextResolver(
            listOf(ContextSource { ContextSourceResult.Found(context) }),
            ProjectEnvironmentLoader(fileSystem),
        )
        var processKey: String? = null
        val keys = ApiKeyResolver(EnvironmentReader { name -> if (name == "DSBUILDER_API_KEY") processKey else null })
        val credentials = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = error("request expected")
            override suspend fun resolve(request: CredentialRequest): CredentialResult = CredentialResult.Selected(
                BackendCredential.ProjectKey(
                    keys.resolve(
                        request.projectKeyOverride,
                        request.credentialEnvName.value,
                        request.projectEnvironment,
                    ).value,
                ),
                BackendCredentialType.PROJECT_KEY,
            )
        }
        val used = mutableListOf<BackendCredential>()
        val reader = modelReader(
            resolver,
            credentials,
        ) { _, credential, path ->
            used += credential
            modelResponse(path)
        }
        val core = server(
            contextResolver = resolver,
            modelReadUseCase = reader,
            config = McpServerConfig(workspace = "/workspace"),
        )
        assertFalse(core.callTool("tokens_list").isError)
        processKey = "process-secret"
        assertFalse(core.callTool("tokens_list").isError)
        assertEquals(
            listOf<BackendCredential>(
                BackendCredential.ProjectKey("file-secret"),
                BackendCredential.ProjectKey("process-secret"),
            ),
            used,
        )
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
        val link = "dsbuilder://projects/project-b/design-systems/" +
            "550e8400-e29b-41d4-a716-446655440003?version=1&platform=compose"
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
                        "dsbuilder://projects/project-a/design-systems/" +
                            "550e8400-e29b-41d4-a716-446655440002?version=1.0.0&platform=compose",
                    ),
                ),
            ),
        )
        val second = server.callTool(
            "design_system_get_context",
            JsonObject(
                mapOf(
                    "designSystem" to JsonPrimitive(
                        "dsbuilder://projects/project-b/design-systems/" +
                            "550e8400-e29b-41d4-a716-446655440003?version=2.0.0&platform=swiftui",
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
        val paths = mutableListOf<String>()
        val core = server(
            modelReadUseCase = modelReader { _, _, path ->
                paths += path
                modelResponse(path)
            },
        )
        listOf("project-a", "project-b").forEach { project ->
            val result = core.callTool(
                "tokens_list",
                JsonObject(
                    mapOf(
                        "designSystem" to JsonPrimitive(
                            "dsbuilder://projects/$project/design-systems/" +
                                "550e8400-e29b-41d4-a716-446655440000?version=1.0.0&platform=compose",
                        ),
                    ),
                ),
            )
            assertFalse(result.isError, result.body)
        }
        assertTrue(paths[0].startsWith("/api/projects/project-a/"))
        assertTrue(paths[1].startsWith("/api/projects/project-b/"))
    }

    @Test
    fun invalidExplicitLinkNeverUsesLocalContext() = runTest {
        val result = server().callTool(
            "design_system_get_context",
            JsonObject(mapOf("designSystem" to JsonPrimitive("dsbuilder://projects/a/design-systems/b?bad=1"))),
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
            ): CredentialResult =
                CredentialResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Token endpoint unavailable")
        }
        val reader = modelReader(provider = provider) { _, _, _ -> error("Backend must not be called") }
        assertErrorCode("BACKEND_UNAVAILABLE", server(modelReadUseCase = reader).callTool("tokens_list"))
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val context = ProjectContext(
        projectId = ProjectId("project-1"),
        designSystemId = DesignSystemId("550e8400-e29b-41d4-a716-446655440000"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/workspace/.sdds/config.json",
        platforms = listOf(TargetPlatform.COMPOSE),
    )

    @Test
    fun listsToolsWithoutResolvingCredentials() {
        val server = server()

        val tools = server.tools()

        assertEquals(27, tools.size)
        assertEquals(
            setOf(
                "design_system_get_context",
                "project_get_status",
                "design_system_versions_list",
                "design_system_version_get",
                "design_system_changes_list",
                "tenants_list",
                "tokens_list",
                "token_get",
                "token_values_get",
                "token_groups_list",
                "palette_get",
                "components_list",
                "component_get",
                "component_styles_get",
                "component_variations_get",
                "component_config_get",
                "component_configurations_list",
                "component_tokens_get",
                "component_properties_get",
                "component_dependencies_get",
                "documentation_publications_list",
                "documentation_search",
                "documentation_fetch",
                "documentation_get_navigation",
                "documentation_get_page",
                "code_binding_search",
                "code_binding_get",
            ),
            tools.map { it.name }.toSet(),
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

        assertTrue(config.description.contains("selected axis value IDs"))
        assertTrue(config.inputSchema.containsKey("appearanceId"))
        assertEquals("array", config.inputSchema.getValue("selectedValueIds").type)
        assertTrue(tools.single { it.name == "component_configurations_list" }.inputSchema.containsKey("componentId"))
        assertTrue(tools.single { it.name == "component_tokens_get" }.inputSchema.containsKey("appearanceId"))
        assertEquals(listOf("light", "dark"), values.inputSchema.getValue("mode").allowedValues)
        assertEquals(listOf("web", "android", "ios"), values.inputSchema.getValue("platform").allowedValues)
        assertTrue(values.inputSchema.getValue("platform").description!!.contains("android for Compose"))
        assertTrue(tokens.inputSchema.containsKey("cursor"))
        assertEquals("integer", components.inputSchema.getValue("limit").type)
        assertTrue(componentVariations.description.contains("published code variations"))
        assertTrue(tokens.inputSchema.containsKey("name"))
        assertTrue(components.inputSchema.containsKey("name"))
        assertTrue(components.inputSchema.containsKey("platform"))
        assertFalse(config.inputSchema.containsKey("componentId"))
        assertFalse(token.inputSchema.containsKey("name"))
        assertFalse(values.inputSchema.containsKey("name"))
        assertFalse(component.inputSchema.containsKey("name"))
        assertTrue(componentStyles.inputSchema.containsKey("name"))
        assertFalse(componentVariations.inputSchema.containsKey("name"))
    }

    @Test
    fun documentationSearchExposesImplementedFilters() {
        val schema = server().tools().single { it.name == "documentation_search" }.inputSchema

        assertTrue(schema.keys.containsAll(listOf("query", "subject", "limit", "cursor", "version", "platform")))
        assertEquals("integer", schema.getValue("limit").type)
    }

    @Test
    fun componentConfigForwardsAppearanceAndSelectedValueIdsUnchanged() = runTest {
        var captured: Pair<String, List<String>>? = null
        val server = server(
            componentReadUseCases = componentReadUseCases(
                object : ComponentReadRemoteSource {
                    override suspend fun configurations(
                        runtime: ComponentReadRuntime,
                        componentId: String,
                        version: String,
                        limit: Int,
                        cursor: String?,
                    ): ComponentReadResult = error("Unexpected configuration listing")

                    override suspend fun tokenReferences(
                        runtime: ComponentReadRuntime,
                        appearanceId: String,
                        selectedValueIds: List<String>,
                        version: String,
                    ): ComponentReadResult = error("Unexpected token reference read")

                    override suspend fun resolvedProperties(
                        runtime: ComponentReadRuntime,
                        appearanceId: String,
                        selectedValueIds: List<String>,
                        version: String,
                    ): ComponentReadResult {
                        captured = appearanceId to selectedValueIds
                        return ComponentReadResult.Success(JsonObject(emptyMap()))
                    }
                },
            ),
        )

        val result = server.callTool(
            "component_config_get",
            JsonObject(
                mapOf(
                    "appearanceId" to JsonPrimitive("appearance-1"),
                    "selectedValueIds" to JsonArray(listOf(JsonPrimitive("value-1"), JsonPrimitive("value-1"))),
                ),
            ),
        )

        assertFalse(result.isError)
        assertEquals("appearance-1" to listOf("value-1", "value-1"), captured)
    }

    @Test
    fun designSystemContextReturnsStableBodyWithoutSecrets() = runTest {
        val server = server()

        val result = server.callTool("design_system_get_context")
        val body = json.parseToJsonElement(result.body).jsonObject

        assertFalse(result.isError)
        assertEquals("project-1", body.getValue("projectId").jsonPrimitive.content)
        assertEquals("550e8400-e29b-41d4-a716-446655440000", body.getValue("designSystemId").jsonPrimitive.content)
        assertEquals("/workspace/.sdds/config.json", body.getValue("configPath").jsonPrimitive.content)
        assertEquals("https://api.example.com", body.getValue("apiUrl").jsonPrimitive.content)
        assertEquals("PROJECT_KEY", body.getValue("credentialType").jsonPrimitive.content)
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
    fun contextReadRequiresCredentialsButToolDiscoveryDoesNot() = runTest {
        val provider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult =
                CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Authentication required")
        }
        val core = server(modelReadUseCase = modelReader(provider = provider) { _, _, _ -> error("No backend call") })
        assertEquals(27, core.tools().size)
        assertErrorCode("AUTH_REQUIRED", core.callTool("design_system_get_context"))
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
        assertErrorCode("INVALID_QUERY", server().callTool("token_get"))
        assertErrorCode("INVALID_QUERY", server().callTool("component_get"))
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

        assertErrorCode("INVALID_QUERY", server().callTool("tokens_list", arguments))
        assertErrorCode("INVALID_QUERY", server().callTool("components_list", arguments))
    }

    @Test
    fun tokenListPassesExactNameAndLimitToBackendWithoutLocalFiltering() = runTest {
        var path = ""
        val core = server(
            modelReadUseCase = modelReader { _, _, requested ->
                path = requested
                modelResponse(requested).copy(body = "[{\"id\":\"server-id\",\"name\":\"server-result\"}]")
            },
        )
        val result = core.callTool(
            "tokens_list",
            JsonObject(mapOf("name" to JsonPrimitive("b"), "limit" to JsonPrimitive(1))),
        )
        assertFalse(result.isError, result.body)
        assertTrue(path.contains("name=b"))
        assertTrue(path.contains("limit=1"))
        val item = (json.parseToJsonElement(result.body).jsonObject.getValue("items") as JsonArray).single().jsonObject
        assertEquals("server-result", item.getValue("name").jsonPrimitive.content)
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

        val result = server.callTool(
            "documentation_search",
            JsonObject(
                mapOf(
                    "query" to JsonPrimitive("button"),
                    "version" to JsonPrimitive("1.0.0"),
                ),
            ),
        )

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
        componentReadUseCases: ComponentReadUseCases? = null,
        modelReadUseCase: ReadDesignSystemModelUseCase = modelReader(contextResolver),
    ): DsBuilderMcpServerCore = DsBuilderMcpServerCore(
        config = config,
        projectStatusReader = projectStatusReader,
        docsReadUseCases = docsReadUseCases,
        componentReadUseCases = componentReadUseCases,
        modelReadUseCase = modelReadUseCase,
    )

    private fun modelReader(
        resolver: ContextResolver = contextResolver(),
        provider: CredentialProvider = credentialProvider(),
        response: (
            String,
            BackendCredential,
            String,
        ) -> AuthenticatedHttpResult.Success = { _, _, path -> modelResponse(path) },
    ): ReadDesignSystemModelUseCase = koinApplication {
        modules(
            dsApplicationModule(),
            module {
                single<ContextResolver> { resolver }
                single<CredentialProvider> { provider }
                single<ApiUrlResolver> { apiUrlResolver() }
                single<AuthenticatedHttpClientFactory> {
                    object : AuthenticatedHttpClientFactory {
                        override fun create(
                            apiUrl: String,
                            apiKey: String,
                        ): AuthenticatedHttpClient = create(apiUrl, BackendCredential.ProjectKey(apiKey))
                        override fun create(
                            apiUrl: String,
                            credential: BackendCredential,
                        ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                            override suspend fun get(path: String): AuthenticatedHttpResult = response(
                                apiUrl,
                                credential,
                                path,
                            )
                            override suspend fun post(
                                path: String,
                                body: String,
                            ): AuthenticatedHttpResult = error("Unexpected POST")
                        }
                    }
                }
            },
        )
    }.koin.get()

    private fun modelResponse(path: String): AuthenticatedHttpResult.Success {
        val ds = path.substringAfter(
            "/design-systems/",
            "550e8400-e29b-41d4-a716-446655440000",
        ).substringBefore('/').substringBefore('?')
        val version = path.substringAfter("version=", "draft").substringBefore('&')
        val context = buildString {
            append("{\"designSystemId\":\"$ds\",\"version\":\"$version\",")
            if (version == "draft") {
                append("\"draftId\":\"550e8400-e29b-41d4-a716-446655440001\",\"draftRevision\":1}")
            } else {
                append("\"versionId\":\"550e8400-e29b-41d4-a716-446655440001\"}")
            }
        }
        val limit = path.substringAfter("limit=", "").substringBefore('&')
        return AuthenticatedHttpResult.Success(
            if (limit.isEmpty()) "{}" else "[]",
            buildMap {
                put("x-ds-read-context", context)
                if (limit.isNotEmpty()) put("x-ds-page-limit", limit)
            },
        )
    }

    private fun docsReadUseCases(remoteSource: DocsReadRemoteSource): DocsReadUseCases =
        DocsReadUseCases(
            RuntimeRequestResolver(contextResolver(), apiUrlResolver(), credentialProvider()),
            remoteSource,
        )

    @Suppress("unused")
    private fun componentReadUseCases(remoteSource: ComponentReadRemoteSource): ComponentReadUseCases =
        ComponentReadUseCases(
            RuntimeRequestResolver(contextResolver(), apiUrlResolver(), credentialProvider()),
            remoteSource,
        )

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
