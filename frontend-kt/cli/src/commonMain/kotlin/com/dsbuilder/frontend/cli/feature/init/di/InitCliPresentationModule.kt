package com.dsbuilder.frontend.cli.feature.init.di

import com.dsbuilder.frontend.cli.feature.init.presentation.InitCliCommand
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import org.koin.core.module.Module
import org.koin.dsl.module
import com.github.ajalt.clikt.command.SuspendingCliktCommand as CliktCommand

/**
 * Создает Koin module для presentation-слоя фичи `init` в `:cli`.
 */
public fun initCliPresentationModule(): Module = module {
    single {
        InitCliCommand(
            initProjectUseCase = get<InitProjectUseCase>(),
            fileSystem = get<WorkspaceFileSystem>(),
            projects = get(),
            systems = get(),
            menu = get(),
        )
    }
    single<CliktCommand> { get<InitCliCommand>() }
}
