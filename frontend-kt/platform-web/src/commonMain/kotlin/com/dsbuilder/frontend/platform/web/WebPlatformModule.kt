package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module платформы React.
 *
 * Делегат не попадает в реестр отсюда: его состав задаёт composition root клиента. Установщика
 * нет: web-генератор живёт в репозитории DS Builder, путь к нему задаётся явно.
 */
public fun webPlatformModule(): Module = module {
    single {
        WebNpmDelegate(
            processRunner = get<ProcessRunner>(),
            locator = WebToolLocator(
                fileSystem = get<WorkspaceFileSystem>(),
                environmentReader = get<EnvironmentReader>(),
            ),
        )
    }
}
