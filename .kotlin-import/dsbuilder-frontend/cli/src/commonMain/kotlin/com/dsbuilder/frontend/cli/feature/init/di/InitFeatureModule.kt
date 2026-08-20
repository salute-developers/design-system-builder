package com.dsbuilder.frontend.cli.feature.init.di

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.feature.init.application.InitProjectUseCase
import com.dsbuilder.frontend.cli.feature.init.application.ProjectConfigWriter
import com.dsbuilder.frontend.cli.feature.init.data.LocalProjectConfigWriter
import com.dsbuilder.frontend.cli.feature.init.presentation.InitCliCommand
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для feature `init`.
 */
public fun initFeatureModule(): Module = module {
    single<ProjectConfigWriter> { LocalProjectConfigWriter(get<ProjectConfigStore>()) }
    single { InitProjectUseCase(get<ProjectConfigWriter>()) }
    single {
        InitCliCommand(
            initProjectUseCase = get<InitProjectUseCase>(),
            fileSystem = get<CliFileSystem>(),
        )
    }
    single<CliktCommand> { get<InitCliCommand>() }
}
