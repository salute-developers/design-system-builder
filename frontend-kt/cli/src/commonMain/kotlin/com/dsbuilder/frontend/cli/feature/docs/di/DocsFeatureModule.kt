package com.dsbuilder.frontend.cli.feature.docs.di

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.feature.docs.application.DocsCodec
import com.dsbuilder.frontend.cli.feature.docs.application.DocsFileSystem
import com.dsbuilder.frontend.cli.feature.docs.application.DocsGenerateUseCase
import com.dsbuilder.frontend.cli.feature.docs.application.DocsHttpClient
import com.dsbuilder.frontend.cli.feature.docs.application.DocsInitUseCase
import com.dsbuilder.frontend.cli.feature.docs.application.DocsPlatformContextReader
import com.dsbuilder.frontend.cli.feature.docs.application.DocsProjectContextAdapter
import com.dsbuilder.frontend.cli.feature.docs.application.DocsProjectContextReader
import com.dsbuilder.frontend.cli.feature.docs.application.DocsPublishUseCase
import com.dsbuilder.frontend.cli.feature.docs.application.DocsStructureReader
import com.dsbuilder.frontend.cli.feature.docs.data.FilesystemPlatformContextReader
import com.dsbuilder.frontend.cli.feature.docs.data.FilesystemStructureReader
import com.dsbuilder.frontend.cli.feature.docs.data.FilesystemValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.data.GzipDocsFileSystem
import com.dsbuilder.frontend.cli.feature.docs.data.HttpDocsPublisher
import com.dsbuilder.frontend.cli.feature.docs.data.JsonDocsCodec
import com.dsbuilder.frontend.cli.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsGenerateCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsInitCliCommand
import com.dsbuilder.frontend.cli.feature.docs.presentation.DocsPublishCliCommand
import com.github.ajalt.clikt.core.CliktCommand
import kotlinx.serialization.json.Json
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для feature `docs`.
 */
public fun docsFeatureModule(): Module = module {
    // Shared JSON codec
    single<Json> {
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
            prettyPrint = true
        }
    }

    // Data layer
    single<DocsStructureReader> { FilesystemStructureReader(get<CliFileSystem>(), get()) }
    single<DocsPlatformContextReader> { FilesystemPlatformContextReader(get<CliFileSystem>(), get()) }
    single<DocsCodec> { JsonDocsCodec(get()) }
    single<DocsFileSystem> { GzipDocsFileSystem(get<CliFileSystem>()) }
    single<DocsValidationEngine> { FilesystemValidationEngine(get<CliFileSystem>()) }
    single<DocsHttpClient> { HttpDocsPublisher(get<CliFileSystem>(), get(), get()) }

    // Application layer — ports
    single<DocsProjectContextReader> { DocsProjectContextAdapter(get()) }

    // Use cases
    single { DocsGenerateUseCase(get(), get(), get(), get(), get(), get<DocsValidationEngine>()) }
    single { DocsInitUseCase(get(), get()) }
    single { DocsPublishUseCase(get(), get(), get(), get()) }

    // Presentation layer
    single { DocsInitCliCommand(get(), get()) }
    single { DocsGenerateCliCommand(get()) }
    single { DocsPublishCliCommand(get()) }
    single { DocsCliCommand(get(), get(), get()) }
    single<CliktCommand> { get<DocsInitCliCommand>() }
    single<CliktCommand> { get<DocsGenerateCliCommand>() }
    single<CliktCommand> { get<DocsPublishCliCommand>() }
}
