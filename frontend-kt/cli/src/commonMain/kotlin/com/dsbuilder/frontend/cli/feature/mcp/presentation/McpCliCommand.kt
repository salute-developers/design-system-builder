package com.dsbuilder.frontend.cli.feature.mcp.presentation

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
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
    private val docsReadUseCases: DocsReadUseCases,
    private val componentReadUseCases: ComponentReadUseCases,
    private val modelReadUseCase: ReadDesignSystemModelUseCase,
    private val checkProjectStatusUseCase: CheckProjectStatusUseCase,
) : CliktCommand(name = "serve") {

    private val workspace: String? by option("--workspace")

    override fun run() {
        runBlocking {
            try {
                DsBuilderMcpServerCore(
                    config = McpServerConfig(apiUrlOverride = null, workspace = workspace),
                    projectStatusReader = CheckProjectStatusMcpReader(checkProjectStatusUseCase),
                    docsReadUseCases = docsReadUseCases,
                    componentReadUseCases = componentReadUseCases,
                    modelReadUseCase = modelReadUseCase,
                ).serveStandardIo()
            } finally {
                runtime.close()
            }
        }
    }

    override fun help(context: Context): String = "Serve DS Builder MCP tools over stdio."
}
