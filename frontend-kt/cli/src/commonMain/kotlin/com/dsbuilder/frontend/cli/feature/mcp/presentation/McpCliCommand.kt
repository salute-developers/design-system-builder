package com.dsbuilder.frontend.cli.feature.mcp.presentation

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.mcpserver.CheckProjectStatusMcpReader
import com.dsbuilder.frontend.mcpserver.DsBuilderMcpServerCore
import com.dsbuilder.frontend.mcpserver.McpServerConfig
import com.dsbuilder.frontend.mcpserver.serveStandardIo
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.coroutines.runBlocking

/**
 * Command group for local MCP server lifecycle.
 */
internal class McpCliCommand(
    serveCommand: McpServeCliCommand,
) : CliktCommand(name = "mcp") {
    init {
        subcommands(serveCommand)
    }

    override fun help(context: Context): String = "Run DS Builder MCP tools."

    override fun run(): Unit = Unit
}

/**
 * `dsbuilder mcp serve`.
 */
internal class McpServeCliCommand(
    private val runtime: ClientRuntime,
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val docsReadUseCases: DocsReadUseCases,
    private val tokenReadUseCases: TokenReadUseCases,
    private val componentReadUseCases: ComponentReadUseCases,
    private val checkProjectStatusUseCase: CheckProjectStatusUseCase,
) : CliktCommand(name = "serve") {
    private val apiUrl: String? by option("--api-url")

    private val workspace: String? by option("--workspace")

    override fun run() {
        runBlocking {
            try {
                DsBuilderMcpServerCore(
                    config = McpServerConfig(apiUrlOverride = apiUrl, workspace = workspace),
                    contextResolver = contextResolver,
                    apiUrlResolver = apiUrlResolver,
                    projectStatusReader = CheckProjectStatusMcpReader(checkProjectStatusUseCase),
                    docsReadUseCases = docsReadUseCases,
                    tokenReadUseCases = tokenReadUseCases,
                    componentReadUseCases = componentReadUseCases,
                ).serveStandardIo()
            } finally {
                runtime.close()
            }
        }
    }

    override fun help(context: Context): String = "Serve DS Builder MCP tools over stdio."
}
