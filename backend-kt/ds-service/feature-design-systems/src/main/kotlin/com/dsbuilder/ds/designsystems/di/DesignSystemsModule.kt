package com.dsbuilder.ds.designsystems.di

import com.dsbuilder.ds.designsystems.application.CreateDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.DesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.application.DesignSystemChangeRepository
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.DesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.application.GetDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.ListChangesByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemAppearancesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemChangeEntriesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentStylesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTenantsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemVersionsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemsUseCase
import com.dsbuilder.ds.designsystems.application.ListVersionsByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemChangeRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemVersionRepository
import org.koin.dsl.module

/** Dependency bindings owned by the design-systems feature. */
val designSystemsModule = module {
    single<DesignSystemRepository> { ExposedDesignSystemRepository() }
    single<DesignSystemVersionRepository> { ExposedDesignSystemVersionRepository() }
    single<DesignSystemChangeRepository> { ExposedDesignSystemChangeRepository() }
    single<DesignSystemAggregateRepository> { ExposedDesignSystemAggregateRepository() }
    factory { ListDesignSystemsUseCase(get(), get(), get()) }
    factory { GetDesignSystemUseCase(get(), get(), get()) }
    factory { CreateDesignSystemUseCase(get(), get(), get(), get()) }
    factory { UpdateDesignSystemUseCase(get(), get(), get()) }
    factory { DeleteDesignSystemUseCase(get(), get(), get()) }
    factory { ListDesignSystemVersionsUseCase(get(), get(), get()) }
    factory { GetDesignSystemVersionUseCase(get(), get(), get()) }
    factory { ListVersionsByDesignSystemUseCase(get(), get(), get()) }
    factory { CreateDesignSystemVersionUseCase(get(), get(), get()) }
    factory { UpdateDesignSystemVersionUseCase(get(), get(), get()) }
    factory { DeleteDesignSystemVersionUseCase(get(), get(), get()) }
    factory { ListDesignSystemChangeEntriesUseCase(get(), get(), get()) }
    factory { GetDesignSystemChangeUseCase(get(), get(), get()) }
    factory { ListChangesByDesignSystemUseCase(get(), get(), get()) }
    factory { CreateDesignSystemChangeUseCase(get(), get(), get()) }
    factory { ListDesignSystemComponentsUseCase(get(), get(), get()) }
    factory { ListDesignSystemTokensUseCase(get(), get(), get()) }
    factory { ListDesignSystemComponentStylesUseCase(get(), get(), get()) }
    factory { ListDesignSystemTenantsUseCase(get(), get(), get()) }
    factory { ListDesignSystemAppearancesUseCase(get(), get(), get()) }
}
