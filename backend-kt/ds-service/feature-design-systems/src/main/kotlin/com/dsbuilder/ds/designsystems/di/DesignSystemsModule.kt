package com.dsbuilder.ds.designsystems.di

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.DesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.DesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.application.DraftChangeRepository
import com.dsbuilder.ds.designsystems.application.GetDesignSystemDraftCursorUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemAppearancesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentStylesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTenantsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemVersionsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemsUseCase
import com.dsbuilder.ds.designsystems.application.ListDraftChangesUseCase
import com.dsbuilder.ds.designsystems.application.ListVersionsByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.RevertDraftChangeUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.VersionBoundaryRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemRepository
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.ExposedVersionBoundaryRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import org.koin.core.qualifier.named
import org.koin.dsl.module

/** Dependency bindings owned by the design-systems feature. */
val designSystemsModule = module {
    single<DraftChangeHandler>(named("design-system")) { designSystemDraftChangeHandler() }
    single<DesignSystemRepository> { ExposedDesignSystemRepository() }
    single<DesignSystemVersionRepository> { ExposedDesignSystemVersionRepository(get()) }
    single<DesignSystemAggregateRepository> { ExposedDesignSystemAggregateRepository() }
    single<VersionBoundaryRepository> { ExposedVersionBoundaryRepository() }
    single<DraftChangeRepository> { ExposedDraftChangeRepository(getAll(), getAll(), getAll()) }
    factory { ListDesignSystemsUseCase(get(), get(), get()) }
    factory { GetDesignSystemUseCase(get(), get(), get()) }
    factory { GetDesignSystemDraftCursorUseCase(get(), get(), get()) }
    factory { CreateDesignSystemUseCase(get(), get(), get(), get(), get(), get(), IdempotentCreateExecutor(get())) }
    factory { UpdateDesignSystemUseCase(get(), get(), get()) }
    factory { DeleteDesignSystemUseCase(get(), get(), get()) }
    factory { ListDesignSystemVersionsUseCase(get(), get(), get()) }
    factory { GetDesignSystemVersionUseCase(get(), get(), get()) }
    factory { ListVersionsByDesignSystemUseCase(get(), get(), get()) }
    factory { CreateDesignSystemVersionUseCase(get(), get(), get(), get()) }
    factory { ListDesignSystemComponentsUseCase(get(), get(), get()) }
    factory { ListDesignSystemTokensUseCase(get(), get(), get()) }
    factory { ListDesignSystemComponentStylesUseCase(get(), get(), get()) }
    factory { ListDesignSystemTenantsUseCase(get(), get(), get()) }
    factory { ListDesignSystemAppearancesUseCase(get(), get(), get()) }
    factory { ListDraftChangesUseCase(get(), get(), get(), get()) }
    factory { RevertDraftChangeUseCase(get(), get(), get(), get()) }
}
