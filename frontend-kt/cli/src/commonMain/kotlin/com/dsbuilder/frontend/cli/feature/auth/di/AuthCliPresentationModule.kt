package com.dsbuilder.frontend.cli.feature.auth.di

import com.dsbuilder.frontend.cli.feature.auth.presentation.AuthCliCommand
import com.dsbuilder.frontend.cli.feature.auth.presentation.AuthLoginCliCommand
import com.dsbuilder.frontend.cli.feature.auth.presentation.AuthLogoutCliCommand
import com.dsbuilder.frontend.cli.feature.auth.presentation.AuthStatusCliCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Creates Koin module for auth CLI presentation.
 */
public fun authCliPresentationModule(): Module = module {
    single { AuthLoginCliCommand(get(), get()) }
    single { AuthStatusCliCommand(get()) }
    single { AuthLogoutCliCommand(get()) }
    single {
        AuthCliCommand(
            listOf(get<AuthLoginCliCommand>(), get<AuthStatusCliCommand>(), get<AuthLogoutCliCommand>()),
        )
    }
}
