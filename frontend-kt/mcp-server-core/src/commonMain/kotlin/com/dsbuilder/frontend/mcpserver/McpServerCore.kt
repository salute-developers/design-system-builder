package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextSelection
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Semantic version reported by both MCP launchers.
 */
public const val MCP_SERVER_VERSION: String = "0.2.0"

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
    /** Required input for the tool schema. */
    public val required: Boolean = false,
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
    private val projectStatusReader: McpProjectStatusReader,
    private val docsReadUseCases: DocsReadUseCases? = null,
    private val componentReadUseCases: ComponentReadUseCases? = null,
    private val modelReadUseCase: ReadDesignSystemModelUseCase? = null,
    private val json: Json = Json { encodeDefaults = true },
) {
    private val readContext = McpReadToolContext(config, json)
    private val documentationMcpTools = DocumentationMcpTools(docsReadUseCases, readContext)
    private val codeBindingMcpTools = CodeBindingMcpTools(docsReadUseCases, readContext)
    private val componentMcpTools = ComponentMcpTools(componentReadUseCases, readContext)

    /** Returns the read-only tools registered by this server core. */
    public fun tools(): List<McpToolDefinition> = readOnlyMcpToolDefinitions()

    /**
     * Dispatches one MCP tool call to the shared application layer.
     */
    @Suppress("CyclomaticComplexMethod")
    public suspend fun callTool(name: String, arguments: JsonObject = JsonObject(emptyMap())): McpToolResult =
        when (name) {
            "design_system_get_context" -> readModelTool(name, arguments)
            "project_get_status" -> projectGetStatus(arguments)
            "design_system_versions_list" -> readModelTool(name, arguments)
            "design_system_version_get" -> readModelTool(name, arguments)
            "design_system_changes_list" -> readModelTool(name, arguments)
            "tenants_list" -> readModelTool(name, arguments)
            "token_groups_list" -> readModelTool(name, arguments)
            "palette_get" -> readModelTool(name, arguments)
            "documentation_search" -> documentationMcpTools.documentationSearch(arguments)
            "documentation_fetch" -> documentationMcpTools.documentationFetch(arguments)
            "documentation_get_navigation" -> documentationMcpTools.documentationNavigation(arguments)
            "documentation_get_page" -> documentationMcpTools.documentationPage(arguments)
            "code_binding_search" -> codeBindingMcpTools.codeBindingSearch(arguments)
            "code_binding_get" -> codeBindingMcpTools.codeBindingGet(arguments)
            "tokens_list" -> readModelTool(name, arguments)
            "token_get" -> readModelTool(name, arguments)
            "token_values_get" -> readModelTool(name, arguments)
            "components_list" -> readModelTool(name, arguments)
            "component_get" -> readModelTool(name, arguments)
            "component_config_get" -> componentMcpTools.componentConfigGet(arguments)
            "component_styles_get" -> readModelTool(name, arguments)
            "component_variations_get" -> readModelTool(name, arguments)
            else -> protocolError("Unknown tool: $name")
        }

    private suspend fun readModelTool(name: String, arguments: JsonObject): McpToolResult {
        val operation = modelToolOperations.getValue(name)
        val schema = modelMcpTools().single { it.name == name }.inputSchema
        val argumentError = modelArgumentError(arguments, schema)
        if (argumentError != null) return toolError("INVALID_QUERY", argumentError)
        val idName = modelResourceArgument(operation)
        val id = idName?.let { arguments.required(it) }
        if (idName != null && id == null) return toolError("INVALID_QUERY", "$idName is required")
        return executeModelTool(operation, id, idName, arguments)
    }

    private suspend fun executeModelTool(
        operation: ModelReadOperation,
        id: String?,
        idName: String?,
        arguments: JsonObject,
    ): McpToolResult {
        val useCase = modelReadUseCase ?: return backendReaderUnavailable()
        val filters = arguments.filterKeys { it !in setOf("designSystem", "version", "limit", "cursor", idName) }
            .mapValues { (_, value) -> (value as JsonPrimitive).content }
        return when (
            val result = useCase.execute(
                ModelReadCommand(
                    operation,
                    id,
                    arguments.optional("version"),
                    filters,
                    arguments.optional("limit")?.toIntOrNull(),
                    arguments.optional("cursor"),
                ),
                runtimeRequest(arguments),
            )
        ) {
            is ModelReadResult.Success -> success(result.value.toString())
            is ModelReadResult.Failed -> toolError(result.code, result.message)
        }
    }

    private fun modelArgumentError(arguments: JsonObject, schema: Map<String, McpToolInputDefinition>): String? {
        if (arguments.keys.any { it != "designSystem" && it !in schema }) {
            return "Unsupported model read argument."
        }
        val invalid = arguments.entries.firstOrNull { (key, value) ->
            val definition = schema[key]
            definition != null && !validModelArgument(value, definition)
        }
        return invalid?.let { "Invalid model read argument: ${it.key}" }
    }

    private fun validModelArgument(value: JsonElement, definition: McpToolInputDefinition): Boolean {
        val primitive = value as? JsonPrimitive ?: return false
        return when (definition.type) {
            "string" -> primitive.isString
            "integer" -> !primitive.isString && primitive.content.toIntOrNull() != null
            else -> false
        }
    }

    private suspend fun projectGetStatus(arguments: JsonObject): McpToolResult =
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

    private fun runtimeRequest(arguments: JsonObject): RuntimeRequest = RuntimeRequest(
        selection = arguments.optional("designSystem")?.let { ContextSelection.Link(it) }
            ?: ContextSelection.Local(config.workspace),
        apiUrlOverride = config.apiUrlOverride,
    )

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

    private fun JsonObject.required(name: String): String? = optional(name)?.takeIf(String::isNotBlank)

    private fun JsonObject.optional(name: String, default: String? = null): String? =
        (this[name] as? JsonPrimitive)?.contentOrNull?.takeIf(String::isNotBlank) ?: default
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
