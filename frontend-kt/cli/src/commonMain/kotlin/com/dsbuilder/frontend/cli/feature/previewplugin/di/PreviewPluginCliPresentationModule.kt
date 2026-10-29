package com.dsbuilder.frontend.cli.feature.previewplugin.di

import com.dsbuilder.frontend.cli.feature.previewplugin.presentation.PreviewPluginCliCommand
import com.dsbuilder.frontend.cli.feature.previewplugin.presentation.PreviewPluginPublishCliCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя команды `preview-plugin` в `:cli`.
 */
public fun previewPluginCliPresentationModule(): Module = module {
    single { PreviewPluginPublishCliCommand(get<PublishPreviewPluginUseCase>()) }
    single { PreviewPluginCliCommand(get<PreviewPluginPublishCliCommand>()) }
    single<CliktCommand> { get<PreviewPluginCliCommand>() }
}
