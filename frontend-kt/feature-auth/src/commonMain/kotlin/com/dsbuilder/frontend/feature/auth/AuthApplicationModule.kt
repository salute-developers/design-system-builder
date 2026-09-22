package com.dsbuilder.frontend.feature.auth

import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.auth.application.AuthStatusUseCase
import com.dsbuilder.frontend.feature.auth.application.LoginUseCase
import com.dsbuilder.frontend.feature.auth.application.LogoutUseCase
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Creates Koin module for user auth use cases.
 */
public fun authApplicationModule(): Module = module {
    single { LoginUseCase(get<ApiUrlResolver>(), get<TokenClient>(), get<CredentialStore>()) }
    single { AuthStatusUseCase(get<ApiUrlResolver>(), get<CredentialStore>()) }
    single { LogoutUseCase(get<ApiUrlResolver>(), get<TokenClient>(), get<CredentialStore>()) }
}
