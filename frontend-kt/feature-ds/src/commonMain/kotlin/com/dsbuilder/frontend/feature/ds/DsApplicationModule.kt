package com.dsbuilder.frontend.feature.ds

import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.feature.ds.application.DesignSystemVersionsSource
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsClient
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsUseCase
import com.dsbuilder.frontend.feature.ds.application.GenerateDesignSystemUseCase
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase
import com.dsbuilder.frontend.feature.ds.application.ModelReadRemoteSource
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import com.dsbuilder.frontend.feature.ds.data.HttpDesignSystemVersionsSource
import com.dsbuilder.frontend.feature.ds.data.HttpDesignSystemsClient
import com.dsbuilder.frontend.feature.ds.data.HttpModelReadRemoteSource
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module для прикладного слоя фичи `ds`.
 *
 * `ds fetch` своего use case не имеет: он вызывает загрузку темы и компонентов из их фич, а фичи
 * не зависят друг от друга — поэтому склейка загрузок живёт в presentation `:cli`.
 */
public fun dsApplicationModule(): Module = module {
    single<DesignSystemsClient> { HttpDesignSystemsClient(get()) }
    single { ListDesignSystemsUseCase(get(), get(), get()) }
    single<DesignSystemVersionsSource> { HttpDesignSystemVersionsSource(get()) }
    single { DiscoverDesignSystemVersionsUseCase(get(), get(), get()) }
    single<ModelReadRemoteSource> { HttpModelReadRemoteSource(get()) }
    single { ReadDesignSystemModelUseCase(RuntimeRequestResolver(get(), get(), get()), get()) }
    single { GenerateDesignSystemUseCase(get<PlatformCapabilityRunner>()) }
}
