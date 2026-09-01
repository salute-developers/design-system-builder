package com.dsbuilder.frontend.feature.init

import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriter
import com.dsbuilder.frontend.feature.init.data.LocalProjectConfigWriter
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для прикладного слоя фичи `init`.
 */
public fun initApplicationModule(): Module = module {
    single<ProjectConfigWriter> { LocalProjectConfigWriter(get<ProjectConfigStore>()) }
    single { InitProjectUseCase(get<ProjectConfigWriter>()) }
}
