package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.analytics.metrica.metricaGoalCatalog
import com.dsbuilder.frontend.mcpserver.DsBuilderMcpServerCore
import com.dsbuilder.frontend.mcpserver.McpProjectStatusReader
import com.dsbuilder.frontend.mcpserver.McpServerConfig

/** Печатает каталог без runtime, файлов, токенов и сетевых обращений. */
internal fun analyticsGoalIdentifiers(): List<String> {
    val core = DsBuilderMcpServerCore(
        McpServerConfig(),
        McpProjectStatusReader { _, _, _ ->
            error("Goal catalog does not execute tools")
        },
    )
    val operations = mapOf("cli" to CLI_ANALYTICS_OPERATIONS, "mcp" to core.tools().map { it.name }.toSet())
    return operations.flatMap { (channel, catalog) -> metricaGoalCatalog(channel, catalog).values }
}

internal fun main() {
    analyticsGoalIdentifiers().forEach(::println)
}
