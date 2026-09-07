package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module делегирования платформам.
 *
 * Реестр делегатов сюда не входит: его состав задаёт composition root клиента, потому что
 * только он знает, какие платформенные адаптеры собраны в конкретное приложение.
 */
public fun corePlatformModule(): Module = module {
    single {
        PlatformCapabilityRunner(
            projectContextReader = get<ProjectContextReader>(),
            registry = get<PlatformDelegateRegistry>(),
            fileSystem = get<WorkspaceFileSystem>(),
        )
    }
}
