package com.dsbuilder.frontend.feature.toolchain

import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsUseCase
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainUseCase
import com.dsbuilder.frontend.feature.toolchain.application.ListToolchainsUseCase
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для прикладного слоя фичи `toolchain`.
 */
public fun toolchainApplicationModule(): Module = module {
    single { ListToolchainsUseCase(get<PlatformDelegateRegistry>()) }
    single {
        DoctorToolchainsUseCase(
            registry = get<PlatformDelegateRegistry>(),
            projectContextReader = get<ProjectContextReader>(),
            fileSystem = get<WorkspaceFileSystem>(),
        )
    }
    single { InstallToolchainUseCase(get<ToolchainInstallerRegistry>()) }
}
