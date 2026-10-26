package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextSelection
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentConfigView
import com.dsbuilder.frontend.feature.components.application.ComponentProjectedConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
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
import kotlinx.serialization.json.JsonArray
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
    /**
     * Returns the read-only tools registered by this server core.
     */
    public fun tools(): List<McpToolDefinition> = (
        listOf(
            McpToolDefinition(name = "project_get_status", description = "Verify backend project access."),
            documentationSearchTool(),
            tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
            tool("documentation_get_navigation", "Read active publication navigation.", "version", "platform"),
            tool("documentation_get_page", "Read one active publication page.", "path", "version", "platform"),
            codeBindingSearchTool(),
            codeBindingGetTool(),
            componentConfigGetTool(),
        ) + modelMcpTools()
        ).map { definition ->
        definition.copy(
            inputSchema = definition.inputSchema + (
                "designSystem" to stringInput(
                    "Optional dsbuilder://projects/{projectId}/design-systems/{designSystemId}" +
                        "?version=... link. The platform query parameter is optional. " +
                        "Selects a resource for this call; it is not an API URL or credential.",
                )
                ),
        )
    }

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
            "documentation_search" -> documentationSearch(arguments)
            "documentation_fetch" -> documentationFetch(arguments)
            "documentation_get_navigation" -> documentationNavigation(arguments)
            "documentation_get_page" -> documentationPage(arguments)
            "code_binding_search" -> codeBindingSearch(arguments)
            "code_binding_get" -> codeBindingGet(arguments)
            "tokens_list" -> readModelTool(name, arguments)
            "token_get" -> readModelTool(name, arguments)
            "token_values_get" -> readModelTool(name, arguments)
            "components_list" -> readModelTool(name, arguments)
            "component_get" -> readModelTool(name, arguments)
            "component_config_get" -> componentConfigGet(arguments)
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
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    private suspend fun documentationFetch(arguments: JsonObject): McpToolResult {
        val kbUrl = arguments.required("kbUrl") ?: return invalidArgument("kbUrl is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.fetch(
            DocumentationFetchCommand(kbUrl),
            runtimeRequest(arguments),
        ).toMcpResult().let { compactDocumentationFetch(json, it) }
    }

    private suspend fun documentationNavigation(arguments: JsonObject): McpToolResult {
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.navigation(
            DocumentationPublicationCommand(arguments.optional("version"), arguments.optional("platform")),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    private suspend fun documentationPage(arguments: JsonObject): McpToolResult {
        val path = arguments.required("path") ?: return invalidArgument("path is required")
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.page(
            DocumentationPageCommand(path, arguments.optional("version"), arguments.optional("platform")),
            runtimeRequest(arguments),
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
            runtimeRequest(arguments),
        ).toMcpResult().let { compactBindingSearch(json, it) }
    }

    @Suppress("ReturnCount")
    private suspend fun codeBindingGet(arguments: JsonObject): McpToolResult {
        val bindingId = arguments.required("bindingId") ?: return invalidArgument("bindingId is required")
        val appearanceNames = arguments.optionalStringArray("appearanceNames")
            ?: return invalidArgument("appearanceNames must be an array of non-empty strings")
        val variationNames = arguments.optionalStringArray("variationNames")
            ?: return invalidArgument("variationNames must be an array of non-empty strings")
        val requestedDetail = arguments.optional("detail")
        val detail = requestedDetail?.let(CodeBindingDetail::parse)
            ?: if (requestedDetail != null) {
                return invalidArgument("detail must be one of: summary, variations, full")
            } else if (variationNames.isNotEmpty()) {
                CodeBindingDetail.VARIATIONS
            } else {
                CodeBindingDetail.SUMMARY
            }
        if (detail == CodeBindingDetail.SUMMARY && variationNames.isNotEmpty()) {
            return invalidArgument("variationNames requires detail variations or full")
        }
        val useCases = docsReadUseCases ?: return backendReaderUnavailable()
        return useCases.getBinding(
            CodeBindingGetCommand(
                bindingId = bindingId,
                publicationId = arguments.optional("publicationId"),
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult().let {
            projectComponentBinding(it, json, appearanceNames.toSet(), variationNames.toSet(), detail)
        }
    }

    private suspend fun componentConfigGet(arguments: JsonObject): McpToolResult {
        val name = arguments.optional("subject")?.toComponentPackageName()
            ?: arguments.optional("name")
            ?: return invalidArgument("subject or name is required")
        val selection = parseVariationSelection(arguments.optional("selection"))
            ?: return invalidArgument("selection must be comma-separated variationId=value pairs without duplicates")
        val projection = arguments.optional("projection") ?: "full"
        val error = projectionError(projection, selection.isEmpty())
        return if (error != null) {
            invalidArgument(error)
        } else {
            readComponentConfig(name, selection, projection, arguments)
        }
    }

    private fun projectionError(projection: String, selectionEmpty: Boolean): String? = when {
        projection !in setOf("full", "token-references") -> "projection must be full or token-references"
        projection == "token-references" && selectionEmpty -> "selection is required for token-references projection"
        else -> null
    }

    private suspend fun readComponentConfig(
        name: String,
        selection: Map<String, String>,
        projection: String,
        arguments: JsonObject,
    ): McpToolResult {
        val useCases = componentReadUseCases ?: return backendReaderUnavailable()
        val view = if (projection == "token-references") {
            ComponentConfigView.TOKEN_REFERENCES
        } else {
            ComponentConfigView.FULL
        }
        val result = useCases.projectedConfig(
            ComponentProjectedConfigReadCommand(
                ComponentConfigReadCommand(name, arguments.optional("style")),
                selection,
                view,
            ),
            runtimeRequest(arguments),
        )
        return if (result is ComponentReadResult.Failed && result.code == ComponentReadErrorCode.INVALID_SELECTION) {
            invalidArgument(result.message)
        } else {
            result.toMcpResult()
        }
    }

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

    private fun ComponentReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is ComponentReadResult.Failed -> toolError(code.name, message)
            is ComponentReadResult.Success -> success(json.encodeToString(value))
        }

    private fun JsonObject.required(name: String): String? = optional(name)?.takeIf(String::isNotBlank)

    private fun JsonObject.optional(name: String, default: String? = null): String? =
        (this[name] as? JsonPrimitive)?.contentOrNull?.takeIf(String::isNotBlank) ?: default

    @Suppress("ReturnCount")
    private fun JsonObject.optionalStringArray(name: String): List<String>? {
        val value = this[name] ?: return emptyList()
        val array = value as? JsonArray ?: return null
        return array.map { element ->
            (element as? JsonPrimitive)
                ?.takeIf(JsonPrimitive::isString)
                ?.contentOrNull
                ?.takeIf(String::isNotBlank)
                ?: return null
        }.distinct()
    }
}

private fun tool(name: String, description: String, vararg inputs: String): McpToolDefinition =
    McpToolDefinition(name = name, description = description, inputSchema = inputs.associateWith { stringInput() })

private fun documentationSearchTool(): McpToolDefinition = McpToolDefinition(
    name = "documentation_search",
    description = "Search published DS Builder documentation. Use limit and subject to narrow results.",
    inputSchema = mapOf(
        "query" to stringInput("Search phrase or technical identifier."),
        "subject" to stringInput("Optional canonical subject filter, for example components.basic-button."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of results."),
        "cursor" to stringInput("Opaque cursor from a previous search page."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput("Exact publication platform, for example compose."),
    ),
)

private fun codeBindingSearchTool(): McpToolDefinition = McpToolDefinition(
    name = "code_binding_search",
    description =
    "Search active published code bindings. Returns compact metadata; " +
        "for questions about available published code variations, start here and then call " +
        "code_binding_get with detail=summary. " +
        "Do not call components_list or component_variations_get for that task. " +
        "Use name for a code symbol such as BasicButton. " +
        "Subject and kind are exact filters: a component uses a canonical subject such as " +
        "components.basic-button and kind component-style, not subject BasicButton or kind component.",
    inputSchema = mapOf(
        "subject" to stringInput(
            "Exact canonical documentation subject, for example components.basic-button. " +
                "This is not the code symbol; use name to search for BasicButton.",
        ),
        "kind" to stringInput(
            description =
            "Exact binding kind. Published component APIs use component-style; " +
                "design tokens use token. The value component is not valid.",
            allowedValues = listOf("component-style", "token"),
        ),
        "name" to stringInput(
            "Case-insensitive substring of the code binding name. " +
                "Use this filter for human-readable code symbols such as BasicButton.",
        ),
        "limit" to McpToolInputDefinition(
            type = "integer",
            description = "Maximum number of bindings to return.",
        ),
        "cursor" to stringInput("Opaque cursor returned by a previous search page."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput(
            "Exact publication platform, for example compose. " +
                "Omit to use the platform from the resolved DS Builder context.",
        ),
    ),
)

private fun codeBindingGetTool(): McpToolDefinition = McpToolDefinition(
    name = "code_binding_get",
    description =
    "Read one published code binding. Component bindings return a compact variation summary by default. " +
        "Use this after code_binding_search to answer which published code variations are available; " +
        "components_list and component_variations_get describe the configuration model instead. " +
        "Use detail=variations for concrete code references and detail=full only when the complete " +
        "style API is needed.",
    inputSchema = mapOf(
        "bindingId" to stringInput("Exact binding ID returned by code_binding_search."),
        "publicationId" to stringInput("Exact publication ID. Omit to resolve the active publication."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput("Exact publication platform, for example compose."),
        "appearanceNames" to stringArrayInput(
            "Optional exact styleName values from platformPayload.styles. Only matching appearances are returned.",
        ),
        "variationNames" to stringArrayInput(
            "Optional exact variation name values. When detail is omitted, this automatically selects " +
                "variations detail.",
        ),
        "detail" to stringInput(
            "Response detail for component bindings: summary returns axes, defaults and counts; " +
                "variations also returns concrete code references; full preserves the complete published payload.",
            allowedValues = listOf("summary", "variations", "full"),
        ),
    ),
)

private fun componentConfigGetTool(): McpToolDefinition = McpToolDefinition(
    name = "component_config_get",
    description =
    "Read the authoritative common component configuration containing token references. " +
        "To continue from a component CodeBinding, pass its canonical subject, for example " +
        "components.basic-button. A Compose reference such as BasicButton.S.Accent " +
        "is not a component style name: " +
        "S and Accent are variation values. Use selection=size=s,view=accent to narrow the response. " +
        "Omit selection and projection to retrieve the unchanged full package.",
    inputSchema = mapOf(
        "subject" to stringInput(
            "Canonical component CodeBinding subject, for example components.basic-button. " +
                "Preferred when continuing from code_binding_search or code_binding_get.",
        ),
        "name" to stringInput(
            "Exact componentName from the exported common-config package, for example basic-button. " +
                "This is not the Compose symbol BasicButton.",
        ),
        "style" to stringInput(
            "Optional exact styleName (product appearance) from the exported package, for example basic-button. " +
                "Do not pass a generated Compose reference or variation combination such as S.Accent; " +
                "omit this filter when the styleName is unknown.",
        ),
        "selection" to stringInput(
            "Comma-separated variation IDs and exact values, for example size=s,view=accent. " +
                "Unknown IDs or values are errors. Unselected axes remain in the full projection.",
        ),
        "projection" to stringInput(
            "full preserves selected config structure; token-references returns only names verified against the " +
                "authoritative token catalog. It requires values for every variation axis " +
                "and does not resolve token values.",
            allowedValues = listOf("full", "token-references"),
        ),
    ),
)

private fun String.toComponentPackageName(): String? =
    removePrefix("components.").takeIf { it.isNotBlank() && it != this }

private fun stringInput(
    description: String? = null,
    allowedValues: List<String> = emptyList(),
): McpToolInputDefinition = McpToolInputDefinition(description = description, allowedValues = allowedValues)

private fun stringArrayInput(description: String): McpToolInputDefinition =
    McpToolInputDefinition(type = "array", description = description, itemType = "string")

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
