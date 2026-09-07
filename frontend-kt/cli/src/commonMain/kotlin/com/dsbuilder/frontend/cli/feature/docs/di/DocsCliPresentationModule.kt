package com.dsbuilder.frontend.cli.feature.docs.di

import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsGenerateCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsInitCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsPublishCliCommand
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsGenerateUseCase
import com.dsbuilder.frontend.feature.docs.application.DocsInitUseCase
import com.dsbuilder.frontend.feature.docs.application.DocsPublishUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для presentation-слоя фичи `docs` в `:cli`.
 */
public fun docsCliPresentationModule(): Module = module {
    single { DocsInitCliCommand(get<DocsInitUseCase>(), get<WorkspaceFileSystem>()) }
    single { DocsGenerateCliCommand(get<DocsGenerateUseCase>()) }
    single { DocsPublishCliCommand(get<DocsPublishUseCase>()) }
    single { DocsCliCommand(get(), get(), get()) }
    single<CliktCommand> { get<DocsInitCliCommand>() }
    single<CliktCommand> { get<DocsGenerateCliCommand>() }
    single<CliktCommand> { get<DocsPublishCliCommand>() }
}
