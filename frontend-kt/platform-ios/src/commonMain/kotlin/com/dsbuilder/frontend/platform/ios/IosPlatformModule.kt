package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module платформы iOS.
 *
 * Сам делегат в реестр не попадает: состав реестра задаёт composition root клиента.
 */
public fun iosPlatformModule(): Module = module {
    single {
        IosCliDelegate(
            processRunner = get<ProcessRunner>(),
            locator = IosToolchainLocator(
                fileSystem = get<WorkspaceFileSystem>(),
                environmentReader = get<EnvironmentReader>(),
            ),
        )
    }
}
