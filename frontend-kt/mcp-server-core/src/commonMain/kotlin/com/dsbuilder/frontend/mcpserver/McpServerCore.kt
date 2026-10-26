package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ProjectContextFailure
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.domain.ContextProvenance
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

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

    /** Reads status for one explicit design-system selection. */
    public suspend fun read(
        apiKeyOverride: String?,
        apiUrlOverride: String?,
        workspace: String?,
        designSystemUri: String?,
    ): CheckProjectStatusResult = read(apiKeyOverride, apiUrlOverride, workspace)
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

    override suspend fun read(
        apiKeyOverride: String?,
        apiUrlOverride: String?,
        workspace: String?,
        designSystemUri: String?,
    ): CheckProjectStatusResult =
        useCase.execute(CheckProjectStatusCommand(apiKeyOverride, apiUrlOverride, workspace, designSystemUri))
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
    /** Serializable input property definitions forwarded to the MCP JSON Schema. */
    public val inputSchema: Map<String, McpToolInputDefinition> = emptyMap(),
)

/**
 * One MCP tool input property before conversion to the SDK-specific JSON Schema type.
 */
@Serializable
public data class McpToolInputDefinition(
    /** JSON Schema primitive type. */
    public val type: String = "string",
    /** Agent-facing parameter semantics and usage guidance. */
    public val description: String? = null,
    /** Optional closed set of accepted string values. */
    public val allowedValues: List<String> = emptyList(),
    /** JSON Schema item type when [type] is `array`. */
    public val itemType: String? = null,
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
    val configPath: String?,
    val apiUrl: String,
    val credentialType: String? = null,
    val provenance: String = "local-config",
    val version: String? = null,
    val platform: String? = null,
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
    private val readContext = McpReadToolContext(config, json)
    private val documentationMcpTools = DocumentationMcpTools(docsReadUseCases, readContext)
    private val codeBindingMcpTools = CodeBindingMcpTools(docsReadUseCases, readContext)
    private val tokenMcpTools = TokenMcpTools(tokenReadUseCases, readContext)
    private val componentMcpTools = ComponentMcpTools(componentReadUseCases, readContext)

    /** Возвращает определения read-only инструментов для обоих launcher. */
    public fun tools(): List<McpToolDefinition> = readOnlyMcpToolDefinitions()

    /**
     * Dispatches one MCP tool call to the shared application layer.
     */
    @Suppress("CyclomaticComplexMethod")
    public suspend fun callTool(name: String, arguments: JsonObject = JsonObject(emptyMap())): McpToolResult =
        when (name) {
            "design_system_get_context" -> designSystemGetContext(arguments)
            "project_get_status" -> projectGetStatus(arguments)
            "documentation_search" -> documentationMcpTools.documentationSearch(arguments)
            "documentation_fetch" -> documentationMcpTools.documentationFetch(arguments)
            "documentation_get_navigation" -> documentationMcpTools.documentationNavigation(arguments)
            "documentation_get_page" -> documentationMcpTools.documentationPage(arguments)
            "code_binding_search" -> codeBindingMcpTools.codeBindingSearch(arguments)
            "code_binding_get" -> codeBindingMcpTools.codeBindingGet(arguments)
            "tokens_list" -> tokenMcpTools.tokensList(arguments)
            "token_get" -> tokenMcpTools.tokenGet(arguments)
            "token_values_get" -> tokenMcpTools.tokenValuesGet(arguments)
            "components_list" -> componentMcpTools.componentsList(arguments)
            "component_get" -> componentMcpTools.componentGet(arguments)
            "component_config_get" -> componentMcpTools.componentConfigGet(arguments)
            "component_styles_get" -> componentMcpTools.componentStylesGet(arguments)
            "component_variations_get" -> componentMcpTools.componentVariationsGet(arguments)
            else -> protocolError("Unknown tool: $name")
        }

    private suspend fun designSystemGetContext(arguments: JsonObject): McpToolResult = with(readContext) {
        val found = when (
            val result = contextResolver.resolve(config.workspace, arguments.optional("designSystem"))
        ) {
            is ProjectContextReadResult.Failed -> return@with toolError(result.reason.toMcpCode(), result.message)
            is ProjectContextReadResult.Found -> result
        }
        val context = found.context
        val apiUrl = apiUrlResolver.resolve(config.apiUrlOverride, found.projectEnvironment)
        return@with success(
            ContextBody(
                projectId = context.projectId.value,
                designSystemId = context.designSystemId.value,
                configPath = context.configPath.takeIf(String::isNotEmpty),
                apiUrl = apiUrl.value,
                provenance = if (context.provenance == ContextProvenance.EXPLICIT_LINK) {
                    "explicit-link"
                } else {
                    "local-config"
                },
                version = context.selectedVersion,
                platform = context.platforms.singleOrNull()?.cliValue,
            ),
        )
    }

    private suspend fun projectGetStatus(arguments: JsonObject): McpToolResult = with(readContext) {
        when (
            val result = projectStatusReader.read(
                null,
                config.apiUrlOverride,
                config.workspace,
                arguments.optional("designSystem"),
            )
        ) {
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
    }

    private fun success(body: ContextBody): McpToolResult =
        McpToolResult(isError = false, body = json.encodeToString(ContextBody.serializer(), body))

    private fun success(body: StatusBody): McpToolResult =
        McpToolResult(isError = false, body = json.encodeToString(StatusBody.serializer(), body))

    private fun protocolError(message: String): McpToolResult =
        McpToolResult(isError = true, body = json.encodeToString(McpToolError("PROTOCOL_ERROR", message)))

    private fun CheckProjectStatusErrorCode.toMcpErrorCode(): String = name

    private fun ProjectContextFailure.toMcpCode(): String = when (this) {
        ProjectContextFailure.NOT_INITIALIZED -> "CONTEXT_REQUIRED"
        ProjectContextFailure.INVALID_CONTEXT -> "INVALID_CONTEXT"
        ProjectContextFailure.INVALID -> "CONTEXT_NOT_FOUND"
    }
}

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
