package com.dsbuilder.frontend.cli.feature.mcp.di

import com.dsbuilder.frontend.cli.feature.mcp.presentation.McpCliCommand
import com.dsbuilder.frontend.cli.feature.mcp.presentation.McpServeCliCommand
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Creates the presentation module for `dsbuilder mcp`.
 */
public fun mcpCliPresentationModule(): Module = module {
    single {
        McpServeCliCommand(
            runtime = get<ClientRuntime>(),
            contextResolver = get<ContextResolver>(),
            apiUrlResolver = get<ApiUrlResolver>(),
            docsReadUseCases = get<DocsReadUseCases>(),
            tokenReadUseCases = get<TokenReadUseCases>(),
            componentReadUseCases = get<ComponentReadUseCases>(),
            checkProjectStatusUseCase = get<CheckProjectStatusUseCase>(),
        )
    }
    single { McpCliCommand(get<McpServeCliCommand>()) }
    single<CliktCommand> { get<McpCliCommand>() }
}
