package com.dsbuilder.frontend.feature.docs

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsCodec
import com.dsbuilder.frontend.feature.docs.application.DocsFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsGenerateUseCase
import com.dsbuilder.frontend.feature.docs.application.DocsHttpClient
import com.dsbuilder.frontend.feature.docs.application.DocsInitUseCase
import com.dsbuilder.frontend.feature.docs.application.DocsPlatformContextReader
import com.dsbuilder.frontend.feature.docs.application.DocsProjectContextAdapter
import com.dsbuilder.frontend.feature.docs.application.DocsProjectContextReader
import com.dsbuilder.frontend.feature.docs.application.DocsPublishUseCase
import com.dsbuilder.frontend.feature.docs.application.DocsStructureReader
import com.dsbuilder.frontend.feature.docs.data.FilesystemPlatformContextReader
import com.dsbuilder.frontend.feature.docs.data.FilesystemStructureReader
import com.dsbuilder.frontend.feature.docs.data.FilesystemValidationEngine
import com.dsbuilder.frontend.feature.docs.data.GzipDocsFileSystem
import com.dsbuilder.frontend.feature.docs.data.HttpDocsPublisher
import com.dsbuilder.frontend.feature.docs.data.JsonDocsCodec
import com.dsbuilder.frontend.feature.docs.domain.DocsValidationEngine
import kotlinx.serialization.json.Json
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для прикладного слоя фичи `docs`.
 */
public fun docsApplicationModule(): Module = module {
    // Shared JSON codec
    single<Json> {
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
            prettyPrint = true
        }
    }

    // Data layer
    single<DocsStructureReader> { FilesystemStructureReader(get<WorkspaceFileSystem>(), get()) }
    single<DocsPlatformContextReader> { FilesystemPlatformContextReader(get<WorkspaceFileSystem>(), get()) }
    single<DocsCodec> { JsonDocsCodec(get()) }
    single<DocsFileSystem> { GzipDocsFileSystem(get<WorkspaceFileSystem>()) }
    single<DocsValidationEngine> { FilesystemValidationEngine(get<WorkspaceFileSystem>()) }
    single<DocsHttpClient> { HttpDocsPublisher(get<WorkspaceFileSystem>(), get(), get()) }

    // Application layer — ports
    single<DocsProjectContextReader> { DocsProjectContextAdapter(get()) }

    // Use cases
    single { DocsGenerateUseCase(get(), get(), get(), get(), get(), get<DocsValidationEngine>()) }
    single { DocsInitUseCase(get(), get()) }
    single { DocsPublishUseCase(get(), get(), get(), get()) }
}
