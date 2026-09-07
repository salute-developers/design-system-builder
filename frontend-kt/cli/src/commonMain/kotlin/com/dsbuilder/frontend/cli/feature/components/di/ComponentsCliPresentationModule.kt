package com.dsbuilder.frontend.cli.feature.components.di

import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsFetchCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsPushCliCommand
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
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
    single { ComponentsCliCommand(get<ComponentsPushCliCommand>(), get<ComponentsFetchCliCommand>()) }
    single<CliktCommand> { get<ComponentsCliCommand>() }
}
