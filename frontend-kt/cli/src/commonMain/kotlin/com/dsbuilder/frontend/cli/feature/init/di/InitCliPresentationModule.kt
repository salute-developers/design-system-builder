package com.dsbuilder.frontend.cli.feature.init.di

import com.dsbuilder.frontend.cli.feature.init.presentation.InitCliCommand
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя фичи `init` в `:cli`.
 */
public fun initCliPresentationModule(): Module = module {
    single {
        InitCliCommand(
            initProjectUseCase = get<InitProjectUseCase>(),
            fileSystem = get<WorkspaceFileSystem>(),
        )
    }
    single<CliktCommand> { get<InitCliCommand>() }
}
