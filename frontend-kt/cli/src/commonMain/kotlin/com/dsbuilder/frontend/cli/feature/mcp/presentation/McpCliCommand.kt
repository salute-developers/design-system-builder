package com.dsbuilder.frontend.cli.feature.mcp.presentation

import com.dsbuilder.frontend.cli.CliAnalyticsSession
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsUseCase
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.projects.application.ListProjectsUseCase
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
    private val listProjectsUseCase: ListProjectsUseCase,
    private val listDesignSystemsUseCase: ListDesignSystemsUseCase,
    private val discoverVersionsUseCase: DiscoverDesignSystemVersionsUseCase,
    private val checkProjectStatusUseCase: CheckProjectStatusUseCase,
) : CliktCommand(name = "serve") {

    private val workspace: String? by option("--workspace")

    override fun run() {
        currentContext.findObject<CliAnalyticsSession>()?.prepare()
        runBlocking {
            try {
                var operations: Set<String> = emptySet()
                val core = DsBuilderMcpServerCore(
                    config = McpServerConfig(apiUrlOverride = null, workspace = workspace),
                    projectStatusReader = CheckProjectStatusMcpReader(checkProjectStatusUseCase),
                    docsReadUseCases = docsReadUseCases,
                    componentReadUseCases = componentReadUseCases,
                    modelReadUseCase = modelReadUseCase,
                    listProjectsUseCase = listProjectsUseCase,
                    listDesignSystemsUseCase = listDesignSystemsUseCase,
                    discoverVersionsUseCase = discoverVersionsUseCase,
                    toolObserver = { operation, outcome ->
                        currentContext.findObject<CliAnalyticsSession>()?.record(
                            "mcp",
                            operations,
                            operation,
                            outcome,
                        )
                    },
                )
                operations = core.tools().map { it.name }.toSet()
                core.serveStandardIo()
            } finally {
                runtime.close()
            }
        }
    }

    override fun help(context: Context): String = "Serve DS Builder MCP tools over stdio."
}
