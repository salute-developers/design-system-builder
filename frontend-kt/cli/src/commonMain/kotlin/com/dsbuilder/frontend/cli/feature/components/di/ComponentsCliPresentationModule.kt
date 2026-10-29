package com.dsbuilder.frontend.cli.feature.components.di

import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsFetchCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsGenerateCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsImportApiCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsPushCliCommand
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.GenerateComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaUseCase
import com.dsbuilder.frontend.feature.components.application.PushComponentsUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя фичи `components` в `:cli`.
 */
public fun componentsCliPresentationModule(): Module = module {
    single { ComponentsPushCliCommand(get<PushComponentsUseCase>()) }
    single { ComponentsFetchCliCommand(get<FetchComponentsUseCase>()) }
    single { ComponentsGenerateCliCommand(get<GenerateComponentsUseCase>()) }
    single { ComponentsImportApiCliCommand(get<ImportApiMetaUseCase>()) }
    single {
        ComponentsCliCommand(
            pushCommand = get<ComponentsPushCliCommand>(),
            fetchCommand = get<ComponentsFetchCliCommand>(),
            generateCommand = get<ComponentsGenerateCliCommand>(),
            importApiCommand = get<ComponentsImportApiCliCommand>(),
        )
    }
    single<CliktCommand> { get<ComponentsCliCommand>() }
}
