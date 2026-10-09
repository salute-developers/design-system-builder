package com.dsbuilder.frontend.cli.feature.ds.di

import com.dsbuilder.frontend.cli.feature.ds.presentation.DsCliCommand
import com.dsbuilder.frontend.cli.feature.ds.presentation.DsFetchCliCommand
import com.dsbuilder.frontend.cli.feature.ds.presentation.DsGenerateCliCommand
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.feature.ds.application.GenerateDesignSystemUseCase
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя фичи `ds` в `:cli`.
 */
public fun dsCliPresentationModule(): Module = module {
    single { DsFetchCliCommand(get<FetchThemesUseCase>(), get<FetchComponentsUseCase>()) }
    single { DsGenerateCliCommand(get<GenerateDesignSystemUseCase>()) }
    single {
        DsCliCommand(
            fetchCommand = get<DsFetchCliCommand>(),
            generateCommand = get<DsGenerateCliCommand>(),
        )
    }
    single<CliktCommand> { get<DsCliCommand>() }
}
