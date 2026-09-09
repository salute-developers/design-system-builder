package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module платформы iOS.
 *
 * Ни делегат, ни установщик в реестры не попадают: их состав задаёт composition root клиента.
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
    single {
        IosToolchainInstaller(
            processRunner = get<ProcessRunner>(),
            fileSystem = get<WorkspaceFileSystem>(),
            environmentReader = get<EnvironmentReader>(),
            releaseSource = { workingDirectory ->
                IosReleaseSource(processRunner = get<ProcessRunner>(), workingDirectory = workingDirectory)
            },
        )
    }
}
