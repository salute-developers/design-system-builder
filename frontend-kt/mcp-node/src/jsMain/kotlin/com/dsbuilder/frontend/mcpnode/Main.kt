package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.mcpserver.CheckProjectStatusMcpReader
import com.dsbuilder.frontend.mcpserver.DsBuilderMcpServerCore
import com.dsbuilder.frontend.mcpserver.MCP_SERVER_VERSION
import com.dsbuilder.frontend.mcpserver.McpServerConfig
import com.dsbuilder.frontend.mcpserver.serveStandardIo
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import org.koin.core.component.get

public fun main() {
    val args = (nodeProcess.argv as Array<String>).drop(2)
    val exitCode = runNodeCli(args)
    if (exitCode != null) {
        nodeProcess.exit(exitCode)
    }
}

internal fun runNodeCli(args: List<String>): Int? =
    when {
        args.isEmpty() || args.first() == "--help" || args.first() == "-h" -> {
            printRootHelp()
            0
        }
        args.first() == "--version" -> {
            println("dsbuilder-mcp $MCP_SERVER_VERSION")
            0
        }
        args.first() == "serve" -> {
            val serveArgs = args.drop(1)
            if (serveArgs.contains("--help") || serveArgs.contains("-h")) {
                printServeHelp()
                0
            } else {
                serve(serveArgs)
                null
            }
        }
        args.first() == "auth" -> {
            runAuth(args.drop(1))
        }
        else -> {
            println("Error: unknown command `${args.first()}`.")
            1
        }
    }

private fun serve(args: List<String>) {
    val apiUrl = optionValue(args, "--api-url")
    val workspace = optionValue(args, "--workspace")
    val runtime = defaultNodeRuntime()
    val koin = nodeKoin(runtime)
    val core = DsBuilderMcpServerCore(
        config = McpServerConfig(apiUrlOverride = apiUrl, workspace = workspace),
        contextResolver = koin.get<ContextResolver>(),
        apiUrlResolver = koin.get<ApiUrlResolver>(),
        projectStatusReader = CheckProjectStatusMcpReader(koin.get<CheckProjectStatusUseCase>()),
        docsReadUseCases = koin.get<DocsReadUseCases>(),
        tokenReadUseCases = koin.get<TokenReadUseCases>(),
        componentReadUseCases = koin.get<ComponentReadUseCases>(),
    )
    MainScope().launch {
        try {
            core.serveStandardIo { error ->
                nodeProcess.stderr.write("${error.message ?: "MCP stdio error"}\n")
            }
        } finally {
            runtime.close()
            nodeProcess.exit(0)
        }
    }
}

private fun printRootHelp() {
    println(
        """
        Usage: dsbuilder-mcp [--version] [--help] <command> [<args>]

        Commands:
          serve    Serve DS Builder MCP tools over stdio.
          auth     Manage DS Builder user authentication.
        """.trimIndent(),
    )
}

private fun printServeHelp() {
    println(
        """
        Usage: dsbuilder-mcp serve [--api-url <url>] [--workspace <path>]

        Options:
          --api-url     Override the DS Builder backend API URL.
          --workspace   Resolve project context from this workspace path.
        """.trimIndent(),
    )
}

internal fun optionValue(args: List<String>, name: String): String? {
    val index = args.indexOf(name)
    return when {
        index >= 0 && index + 1 < args.size -> args[index + 1]
        else -> args.firstOrNull { it.startsWith("$name=") }?.substringAfter("=")
    }
}
