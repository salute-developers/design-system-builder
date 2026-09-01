package com.dsbuilder.frontend.cli.feature.status.di

import com.dsbuilder.frontend.cli.feature.status.presentation.StatusCliCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя фичи `status` в `:cli`.
 */
public fun statusCliPresentationModule(): Module = module {
    single {
        StatusCliCommand(
            checkProjectStatusUseCase = get<CheckProjectStatusUseCase>(),
        )
    }
    single<CliktCommand> { get<StatusCliCommand>() }
}
