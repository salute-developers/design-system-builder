package com.dsbuilder.frontend.cli.feature.toolchain.di

import com.dsbuilder.frontend.cli.feature.toolchain.presentation.ToolchainCliCommand
import com.dsbuilder.frontend.cli.feature.toolchain.presentation.ToolchainDoctorCliCommand
import com.dsbuilder.frontend.cli.feature.toolchain.presentation.ToolchainInstallCliCommand
import com.dsbuilder.frontend.cli.feature.toolchain.presentation.ToolchainListCliCommand
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsUseCase
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainUseCase
import com.dsbuilder.frontend.feature.toolchain.application.ListToolchainsUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для presentation-слоя фичи `toolchain` в `:cli`.
 */
public fun toolchainCliPresentationModule(): Module = module {
    single { ToolchainListCliCommand(get<ListToolchainsUseCase>()) }
    single { ToolchainDoctorCliCommand(get<DoctorToolchainsUseCase>()) }
    single { ToolchainInstallCliCommand(get<InstallToolchainUseCase>()) }
    single {
        ToolchainCliCommand(
            listCommand = get<ToolchainListCliCommand>(),
            doctorCommand = get<ToolchainDoctorCliCommand>(),
            installCommand = get<ToolchainInstallCliCommand>(),
        )
    }
    single<CliktCommand> { get<ToolchainCliCommand>() }
}
