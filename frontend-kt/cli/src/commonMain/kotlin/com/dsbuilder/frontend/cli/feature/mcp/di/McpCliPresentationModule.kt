package com.dsbuilder.frontend.cli.feature.mcp.di

import com.dsbuilder.frontend.cli.feature.mcp.presentation.McpCliCommand
import com.dsbuilder.frontend.cli.feature.mcp.presentation.McpServeCliCommand
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
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
            docsReadUseCases = get<DocsReadUseCases>(),
            componentReadUseCases = get<ComponentReadUseCases>(),
            modelReadUseCase = get<ReadDesignSystemModelUseCase>(),
            checkProjectStatusUseCase = get<CheckProjectStatusUseCase>(),
        )
    }
    single { McpCliCommand(get<McpServeCliCommand>()) }
    single<CliktCommand> { get<McpCliCommand>() }
}
