package com.dsbuilder.frontend.cli.feature.icons.di

import com.dsbuilder.frontend.cli.feature.icons.presentation.IconsCliCommand
import com.dsbuilder.frontend.cli.feature.icons.presentation.IconsPublishCliCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogUseCase
import org.koin.core.module.Module
import org.koin.dsl.module
import com.github.ajalt.clikt.command.SuspendingCliktCommand as CliktCommand

/**
 * Создает Koin module для presentation-слоя команды `icons` в `:cli`.
 */
public fun iconsCliPresentationModule(): Module = module {
    single { IconsPublishCliCommand(get<PublishIconCatalogUseCase>()) }
    single { IconsCliCommand(get<IconsPublishCliCommand>()) }
    single<CliktCommand> { get<IconsCliCommand>() }
}
