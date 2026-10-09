package com.dsbuilder.frontend.feature.ds

import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.feature.ds.application.GenerateDesignSystemUseCase
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для прикладного слоя фичи `ds`.
 *
 * `ds fetch` своего use case не имеет: он вызывает загрузку темы и компонентов из их фич, а фичи
 * не зависят друг от друга — поэтому склейка загрузок живёт в presentation `:cli`.
 */
public fun dsApplicationModule(): Module = module {
    single { GenerateDesignSystemUseCase(get<PlatformCapabilityRunner>()) }
}
