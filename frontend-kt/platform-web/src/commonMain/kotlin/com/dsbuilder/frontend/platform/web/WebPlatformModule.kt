package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module платформы React: делегат и установщик web-генератора.
 *
 * Делегат и установщик не попадают в реестры отсюда: их состав задаёт composition root клиента.
 */
public fun webPlatformModule(): Module = module {
    single {
        WebToolLocator(
            fileSystem = get<WorkspaceFileSystem>(),
            environmentReader = get<EnvironmentReader>(),
            processRunner = get<ProcessRunner>(),
        )
    }
    single { WebNpmDelegate(processRunner = get<ProcessRunner>(), locator = get<WebToolLocator>()) }
    single {
        WebToolchainInstaller(
            processRunner = get<ProcessRunner>(),
            locator = get<WebToolLocator>(),
            fileSystem = get<WorkspaceFileSystem>(),
        )
    }
}
