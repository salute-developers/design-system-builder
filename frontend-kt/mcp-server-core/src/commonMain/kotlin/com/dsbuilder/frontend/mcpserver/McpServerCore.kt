package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSelection
import com.dsbuilder.frontend.core.application.ProjectContextFailure
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.domain.ContextProvenance
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentConfigView
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentListReadCommand
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
        documentationSearchTool(),
        tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
        tool("documentation_get_navigation", "Read active publication navigation.", "version", "platform"),
        tool("documentation_get_page", "Read one active publication page.", "path", "version", "platform"),
        codeBindingSearchTool(),
        codeBindingGetTool(),
        tokensListTool(),
        tool("token_get", "Read one authoritative design-system token by stable ID.", "tokenId"),
        tokenValuesGetTool(),
        componentsListTool(),
        tool("component_get", "Read one authoritative design-system component by stable ID.", "componentId"),
        componentConfigGetTool(),
        tool("component_styles_get", "Read authoritative component styles by stable component ID.", "componentId"),
        tool(
            "component_variations_get",
            "Read authoritative configuration-model variations by stable component ID. " +
                "Do not use this tool to list published code variations; " +
                "use code_binding_search followed by code_binding_get with detail=summary instead.",
            "componentId",
        ),
    ).map { definition ->
        definition.copy(
            inputSchema = definition.inputSchema + (
                "designSystem" to stringInput(
                    "Optional dsbuilder://projects/{projectId}/design-systems/{designSystemId}" +
                        "?version=...&platform=... link. " +
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
            "design_system_get_context" -> designSystemGetContext(arguments)
            "project_get_status" -> projectGetStatus(arguments)
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

    private suspend fun designSystemGetContext(arguments: JsonObject): McpToolResult {
        val found = when (
            val result = contextResolver.resolve(config.workspace, arguments.optional("designSystem"))
        ) {
            is ProjectContextReadResult.Failed -> return toolError(result.reason.toMcpCode(), result.message)
            is ProjectContextReadResult.Found -> result
        }
        val context = found.context
        val apiUrl = apiUrlResolver.resolve(config.apiUrlOverride, found.projectEnvironment)
        return success(
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

    private suspend fun tokensList(arguments: JsonObject): McpToolResult {
        val name = arguments.optional("name")
        val query = arguments.optional("query")
        if (name != null && query != null) return invalidArgument("name and query are mutually exclusive")
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.list(
            TokenListReadCommand(arguments.optional("type"), name ?: query),
            runtimeRequest(arguments),
        ).toMcpResult().let {
            compactTokenList(it, json, name, arguments.optional("limit")?.toIntOrNull())
        }
    }

    private suspend fun tokenGet(arguments: JsonObject): McpToolResult {
        val tokenId = arguments.required("tokenId") ?: return invalidArgument("tokenId is required")
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.get(
            TokenGetReadCommand(tokenId),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    private suspend fun tokenValuesGet(arguments: JsonObject): McpToolResult {
        val tokenId = arguments.required("tokenId") ?: return invalidArgument("tokenId is required")
        val useCases = tokenReadUseCases ?: return backendReaderUnavailable()
        return useCases.values(
            TokenValuesReadCommand(
                tokenId = tokenId,
                tenantId = arguments.optional("tenantId"),
                mode = arguments.optional("mode"),
                platform = arguments.optional("platform"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    private suspend fun componentsList(arguments: JsonObject): McpToolResult {
        val name = arguments.optional("name")
        val query = arguments.optional("query")
        if (name != null && query != null) return invalidArgument("name and query are mutually exclusive")
        val useCases = componentReadUseCases ?: return backendReaderUnavailable()
        return useCases.list(
            ComponentListReadCommand(name ?: query, arguments.optional("platform")),
            runtimeRequest(arguments),
        ).toMcpResult().let {
            compactComponentList(it, json, name, arguments.optional("limit")?.toIntOrNull())
        }
    }

    private suspend fun componentGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.get(
                ComponentGetReadCommand(it),
                runtimeRequest(arguments),
            )
        }

    private suspend fun componentStylesGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.styles(
                ComponentGetReadCommand(it),
                runtimeRequest(arguments),
            )
        }

    private suspend fun componentVariationsGet(arguments: JsonObject): McpToolResult =
        componentIdentifier(arguments) {
            componentReadUseCases?.variations(
                ComponentGetReadCommand(it),
                runtimeRequest(arguments),
            )
        }

    private suspend fun componentIdentifier(
        arguments: JsonObject,
        block: suspend (String) -> ComponentReadResult?,
    ): McpToolResult {
        val componentId = arguments.required("componentId") ?: return invalidArgument("componentId is required")
        val result = block(componentId) ?: return backendReaderUnavailable()
        return result.toMcpResult()
    }

    @Suppress("ReturnCount", "CyclomaticComplexMethod")
    private suspend fun componentConfigGet(arguments: JsonObject): McpToolResult {
        val name = arguments.optional("subject")?.toComponentPackageName()
            ?: arguments.optional("name")
            ?: return invalidArgument("subject or name is required")
        val selection = parseVariationSelection(arguments.optional("selection"))
            ?: return invalidArgument("selection must be comma-separated variationId=value pairs without duplicates")
        val projection = arguments.optional("projection") ?: "full"
        if (projection !in setOf("full", "token-references")) {
            return invalidArgument("projection must be full or token-references")
        }
        if (projection == "token-references" && selection.isEmpty()) {
            return invalidArgument("selection is required for token-references projection")
        }
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

    private fun ProjectContextFailure.toMcpCode(): String = when (this) {
        ProjectContextFailure.NOT_INITIALIZED -> "CONTEXT_REQUIRED"
        ProjectContextFailure.INVALID_CONTEXT -> "INVALID_CONTEXT"
        ProjectContextFailure.INVALID -> "CONTEXT_NOT_FOUND"
    }

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
        "version" to stringInput("Exact documentation version."),
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
        "version" to stringInput("Exact documentation version. Omit to use the active publication."),
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
        "version" to stringInput("Exact documentation version. Omit to use the active version."),
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

private fun tokenValuesGetTool(): McpToolDefinition = McpToolDefinition(
    name = "token_values_get",
    description =
    "Read authoritative light or dark values for a token resolved to a stable ID with tokens_list. " +
        "Compose uses the android model platform; omit platform to return all platform rows.",
    inputSchema = mapOf(
        "tokenId" to stringInput("Stable token model UUID returned by tokens_list."),
        "tenantId" to stringInput("Optional tenant UUID from the resolved design-system context."),
        "mode" to stringInput("Theme mode.", allowedValues = listOf("light", "dark")),
        "platform" to stringInput(
            "Design-system model platform. Use android for Compose; compose is not valid here. " +
                "Omit to return web, ios, and android rows.",
            allowedValues = listOf("web", "android", "ios"),
        ),
    ),
)

private fun tokensListTool(): McpToolDefinition = McpToolDefinition(
    name = "tokens_list",
    description =
    "Search the authoritative token catalog by token metadata. This tool does not search component usage: " +
        "queries such as BasicButton or button may be empty even when the component uses tokens. " +
        "Read component_config_get first, then look up the exact token names found in its properties and use the " +
        "returned stable IDs with token_get or token_values_get.",
    inputSchema = mapOf(
        "type" to stringInput(
            "Optional exact token type.",
            allowedValues = listOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"),
        ),
        "name" to stringInput(
            "Optional exact token name. It is sent through the existing backend query and checked exactly by MCP. " +
                "Do not combine with query.",
        ),
        "query" to stringInput("Substring matched against token metadata, not component-to-token dependencies."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of tokens to return."),
    ),
)

private fun componentsListTool(): McpToolDefinition = McpToolDefinition(
    name = "components_list",
    description =
    "Search authoritative design-system component metadata. Returns compact summaries; use component_get for the " +
        "full component DTO. Do not use this tool to discover published code variations; " +
        "use code_binding_search followed by code_binding_get with detail=summary instead.",
    inputSchema = mapOf(
        "name" to stringInput(
            "Optional exact component name. It is sent through the existing backend query and checked exactly by " +
                "MCP. Do not combine with query.",
        ),
        "query" to stringInput("Substring matched against component name and description."),
        "platform" to stringInput("Optional target platform retained for the component-list contract."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of components to return."),
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
