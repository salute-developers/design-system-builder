package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentListReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.CodeBindingGetCommand
import com.dsbuilder.frontend.feature.docs.application.CodeBindingSearchCommand
import com.dsbuilder.frontend.feature.docs.application.DocsReadResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocumentationFetchCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPageCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenGetReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenListReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenReadResult
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.feature.theme.application.TokenValuesReadCommand
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Semantic version reported by both MCP launchers.
 */
public const val MCP_SERVER_VERSION: String = "0.1.0"

/**
 * Runtime inputs shared by the CLI and Node MCP launchers.
 */
public data class McpServerConfig(
    /** Optional backend API URL supplied by launcher arguments. */
    public val apiUrlOverride: String? = null,
    /** Optional starting directory for common project context resolution. */
    public val workspace: String? = null,
)

/**
 * Adapter used by MCP handlers to read project status without depending on CLI presentation.
 */
public fun interface McpProjectStatusReader {
    /**
     * Reads backend project status with the shared credential and API URL semantics.
     */
    public suspend fun read(
        apiKeyOverride: String?,
        apiUrlOverride: String?,
        workspace: String?,
    ): CheckProjectStatusResult
}

/**
 * MCP status reader backed by the existing status use case.
 */
public class CheckProjectStatusMcpReader(
    private val useCase: CheckProjectStatusUseCase,
) : McpProjectStatusReader {
    override suspend fun read(
        apiKeyOverride: String?,
        apiUrlOverride: String?,
        workspace: String?,
    ): CheckProjectStatusResult =
        useCase.execute(CheckProjectStatusCommand(apiKeyOverride, apiUrlOverride, workspace))
}

/**
 * JSON-compatible MCP tool metadata used by contract tests and launchers.
 */
@Serializable
public data class McpToolDefinition(
    /** Stable MCP tool name. */
    public val name: String,
    /** Human-readable tool description. */
    public val description: String,
    /** Minimal serializable input schema descriptor. */
    public val inputSchema: Map<String, String> = emptyMap(),
)

/**
 * Stable tool handler result before conversion to SDK-specific result types.
 */
@Serializable
public data class McpToolResult(
    /** Whether the tool result represents a domain/tool error. */
    public val isError: Boolean,
    /** Serialized JSON payload returned to the MCP client. */
    public val body: String,
)

/**
 * Stable structured error payload for backend and context failures.
 */
@Serializable
public data class McpToolError(
    /** Stable machine-readable error code. */
    public val code: String,
    /** Sanitized user-facing error message. */
    public val message: String,
    /** Optional sanitized structured details. */
    public val details: Map<String, String> = emptyMap(),
)

@Serializable
private data class ContextBody(
    val projectId: String,
    val designSystemId: String,
    val configPath: String,
    val apiUrl: String,
    val credentialType: String? = null,
)

@Serializable
private data class StatusBody(
    val projectName: String,
    val designSystemName: String,
    val configPath: String,
    val apiUrl: String,
)

/**
 * Shared MCP tool registry and handlers. Transport-specific launchers adapt this to stdio.
 */
public class DsBuilderMcpServerCore(
    private val config: McpServerConfig,
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val projectStatusReader: McpProjectStatusReader,
    private val docsReadUseCases: DocsReadUseCases? = null,
    private val tokenReadUseCases: TokenReadUseCases? = null,
    private val componentReadUseCases: ComponentReadUseCases? = null,
    private val json: Json = Json { encodeDefaults = true },
) {
    /**
     * Returns the read-only tools registered by this server core.
     */
    public fun tools(): List<McpToolDefinition> = listOf(
        McpToolDefinition(
            name = "design_system_get_context",
            description = "Return resolved DS Builder project and design-system context.",
        ),
        McpToolDefinition(
            name = "project_get_status",
            description = "Verify backend access for the resolved DS Builder project.",
        ),
        tool(
            "documentation_search",
            "Search published DS Builder documentation.",
            "query",
            "version",
            "platform",
        ),
        tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
        tool("documentation_get_navigation", "Read active publication navigation.", "version", "platform"),
        tool("documentation_get_page", "Read one active publication page.", "path", "version", "platform"),
        tool(
            "code_binding_search",
            "Search published code bindings.",
            "subject",
            "kind",
            "name",
            "limit",
            "cursor",
            "version",
            "platform",
        ),
        tool(
            "code_binding_get",
            "Read one published code binding.",
            "bindingId",
            "publicationId",
            "version",
            "platform",
        ),
        tool("tokens_list", "List authoritative design-system tokens.", "type", "query", "limit"),
        tool("token_get", "Read one authoritative design-system token.", "tokenId", "name"),
        tool(
            "token_values_get",
            "Read authoritative token values.",
            "tokenId",
            "name",
            "tenantId",
            "themeId",
            "mode",
            "platform",
        ),
        tool("components_list", "List authoritative design-system components.", "query", "platform", "limit"),
        tool("component_get", "Read one authoritative design-system component.", "componentId", "name"),
        tool("component_config_get", "Read authoritative component common config.", "componentId", "name", "style"),
        tool("component_styles_get", "Read authoritative component styles.", "componentId", "name"),
        tool("component_variations_get", "Read authoritative component variations.", "componentId", "name"),
    )

    /**
     * Dispatches one MCP tool call to the shared application layer.
     */
    @Suppress("CyclomaticComplexMethod")
    public suspend fun callTool(name: String, arguments: JsonObject = JsonObject(emptyMap())): McpToolResult =
        when (name) {
            "design_system_get_context" -> designSystemGetContext()
            "project_get_status" -> projectGetStatus()
            "documentation_search" -> documentationSearch(arguments)
            "documentation_fetch" -> documentationFetch(arguments)
            "documentation_get_navigation" -> documentationNavigation(arguments)
            "documentation_get_page" -> documentationPage(arguments)
            "code_binding_search" -> codeBindingSearch(arguments)
            "code_binding_get" -> codeBindingGet(arguments)
            "tokens_list" -> tokensList(arguments)
            "token_get" -> tokenGet(arguments)
            "token_values_get" -> tokenValuesGet(arguments)
            "components_list" -> componentsList(arguments)
            "component_get" -> componentGet(arguments)
            "component_config_get" -> componentConfigGet(arguments)
            "component_styles_get" -> componentStylesGet(arguments)
            "component_variations_get" -> componentVariationsGet(arguments)
            else -> protocolError("Unknown tool: $name")
        }

    private suspend fun designSystemGetContext(): McpToolResult {
        val apiUrl = apiUrlResolver.resolve(config.apiUrlOverride)
        val context = when (val result = contextResolver.resolve(config.workspace)) {
            is ProjectContextReadResult.Failed -> return toolError("CONTEXT_NOT_FOUND", result.message)
            is ProjectContextReadResult.Found -> result.context
        }
        return success(
            ContextBody(
                projectId = context.projectId.value,
                designSystemId = context.designSystemId.value,
                configPath = context.configPath,
                apiUrl = apiUrl.value,
            ),
        )
    }

    private suspend fun projectGetStatus(): McpToolResult =
        when (val result = projectStatusReader.read(null, config.apiUrlOverride, config.workspace)) {
            is CheckProjectStatusResult.Authorized -> success(
                StatusBody(
                    projectName = result.projectName,
                    designSystemName = result.designSystemName,
                    configPath = result.configPath,
                    apiUrl = result.apiUrl,
                ),
            )
            is CheckProjectStatusResult.Failed -> toolError(result.code.toMcpErrorCode(), result.message)
        }

    private suspend fun documentationSearch(arguments: JsonObject): McpToolResult {
        val query = arguments.required("query") ?: return invalidArgument("query is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.search(
            DocumentationSearchCommand(
                query = query,
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
                cursor = arguments.optional("cursor"),
                limit = arguments.optional("limit"),
                subject = arguments.optional("subject"),
            ),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun documentationFetch(arguments: JsonObject): McpToolResult {
        val kbUrl = arguments.required("kbUrl") ?: return invalidArgument("kbUrl is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.fetch(DocumentationFetchCommand(kbUrl), config.apiUrlOverride, config.workspace).toMcpResult()
    }

    private suspend fun documentationNavigation(arguments: JsonObject): McpToolResult {
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.navigation(
            DocumentationPublicationCommand(arguments.optional("version"), arguments.optional("platform")),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun documentationPage(arguments: JsonObject): McpToolResult {
        val path = arguments.required("path") ?: return invalidArgument("path is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.page(
            DocumentationPageCommand(path, arguments.optional("version"), arguments.optional("platform")),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun codeBindingSearch(arguments: JsonObject): McpToolResult {
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.searchBindings(
            CodeBindingSearchCommand(
                subject = arguments.optional("subject"),
                kind = arguments.optional("kind"),
                name = arguments.optional("name"),
                limit = arguments.optional("limit"),
                cursor = arguments.optional("cursor"),
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
            ),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun codeBindingGet(arguments: JsonObject): McpToolResult {
        val bindingId = arguments.required("bindingId") ?: return invalidArgument("bindingId is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.getBinding(
            CodeBindingGetCommand(
                bindingId = bindingId,
                publicationId = arguments.optional("publicationId"),
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
            ),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun tokensList(arguments: JsonObject): McpToolResult {
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.list(
            TokenListReadCommand(arguments.optional("type"), arguments.optional("query")),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult().limitDataArray(arguments.optional("limit")?.toIntOrNull())
    }

    private suspend fun tokenGet(arguments: JsonObject): McpToolResult {
        val identifier = arguments.optional("tokenId") ?: arguments.optional("name")
            ?: return invalidArgument("tokenId or name is required")
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.get(TokenGetReadCommand(identifier), config.apiUrlOverride, config.workspace).toMcpResult()
    }

    private suspend fun tokenValuesGet(arguments: JsonObject): McpToolResult {
        val identifier = arguments.optional("tokenId") ?: arguments.optional("name")
            ?: return invalidArgument("tokenId or name is required")
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.values(
            TokenValuesReadCommand(
                identifier = identifier,
                tenantId = arguments.optional("tenantId"),
                themeId = arguments.optional("themeId"),
                mode = arguments.optional("mode"),
                platform = arguments.optional("platform"),
            ),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private suspend fun componentsList(arguments: JsonObject): McpToolResult {
        val useCases = componentReadUseCases ?: return backendReaderUnavailable()
        return useCases.list(
            ComponentListReadCommand(arguments.optional("query"), arguments.optional("platform")),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult().limitDataArray(arguments.optional("limit")?.toIntOrNull())
    }

    private suspend fun componentGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.get(ComponentGetReadCommand(it), config.apiUrlOverride, config.workspace)
        }

    private suspend fun componentStylesGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.styles(ComponentGetReadCommand(it), config.apiUrlOverride, config.workspace)
        }

    private suspend fun componentVariationsGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.variations(ComponentGetReadCommand(it), config.apiUrlOverride, config.workspace)
        }

    private suspend fun componentIdentifier(
        arguments: JsonObject,
        block: suspend (String) -> ComponentReadResult?,
    ): McpToolResult {
        val identifier = arguments.optional("componentId") ?: arguments.optional("name")
            ?: return invalidArgument("componentId or name is required")
        val result = block(identifier) ?: return backendReaderUnavailable()
        return result.toMcpResult()
    }

    private suspend fun componentConfigGet(arguments: JsonObject): McpToolResult {
        val name = arguments.optional("name") ?: arguments.optional("componentId")
            ?: return invalidArgument("componentId or name is required")
        val useCases = componentReadUseCases ?: return backendReaderUnavailable()
        return useCases.config(
            ComponentConfigReadCommand(name, arguments.optional("style")),
            config.apiUrlOverride,
            config.workspace,
        ).toMcpResult()
    }

    private fun success(body: ContextBody): McpToolResult =
        McpToolResult(isError = false, body = json.encodeToString(ContextBody.serializer(), body))

    private fun success(body: StatusBody): McpToolResult =
        McpToolResult(isError = false, body = json.encodeToString(StatusBody.serializer(), body))

    private fun success(body: String): McpToolResult = McpToolResult(isError = false, body = body.ifBlank { "{}" })

    private fun toolError(code: String, message: String): McpToolResult =
        McpToolResult(isError = true, body = json.encodeToString(McpToolError(code, message)))

    private fun invalidArgument(message: String): McpToolResult = toolError("INVALID_ARGUMENT", message)

    private fun backendReaderUnavailable(): McpToolResult =
        toolError("BACKEND_UNAVAILABLE", "Backend read tools are not configured.")

    private fun protocolError(message: String): McpToolResult =
        McpToolResult(isError = true, body = json.encodeToString(McpToolError("PROTOCOL_ERROR", message)))

    private fun CheckProjectStatusErrorCode.toMcpErrorCode(): String = name

    private fun DocsReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is DocsReadResult.Failed -> toolError(code.name, message)
            is DocsReadResult.Success -> success(json.encodeToString(value))
        }

    private fun TokenReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is TokenReadResult.Failed -> toolError(code.name, message)
            is TokenReadResult.Success -> success(json.encodeToString(value))
        }

    private fun ComponentReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is ComponentReadResult.Failed -> toolError(code.name, message)
            is ComponentReadResult.Success -> success(json.encodeToString(value))
        }

    private fun McpToolResult.limitDataArray(limit: Int?): McpToolResult {
        val limitedBody =
            limit
                ?.takeIf { !isError && it > 0 }
                ?.let { requestedLimit ->
                    val element = runCatching { json.parseToJsonElement(body) }.getOrNull() as? JsonObject
                    val array = element?.get("data") as? JsonArray
                    array?.let { JsonObject(element + ("data" to JsonArray(it.take(requestedLimit)))) }
                }

        return limitedBody?.let { success(json.encodeToString(it)) } ?: this
    }

    private fun JsonObject.required(name: String): String? = optional(name)?.takeIf(String::isNotBlank)

    private fun JsonObject.optional(name: String, default: String? = null): String? =
        (this[name] as? JsonPrimitive)?.contentOrNull?.takeIf(String::isNotBlank) ?: default
}

private fun tool(name: String, description: String, vararg inputs: String): McpToolDefinition =
    McpToolDefinition(name = name, description = description, inputSchema = inputs.associateWith { "string" })

/**
 * Serves MCP over the platform standard input and output streams.
 */
public expect suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit = {})

internal expect fun standardInputSource(): Source

internal expect fun standardOutputSink(): Sink

internal expect fun installProcessShutdownHandler(onShutdown: () -> Unit): ProcessShutdownRegistration

internal interface ProcessShutdownRegistration {
    fun close()
}
