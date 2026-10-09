package com.dsbuilder.ds.themes.di

import com.dsbuilder.ds.themes.application.CreateTenantUseCase
import com.dsbuilder.ds.themes.application.DeleteTenantUseCase
import com.dsbuilder.ds.themes.application.GetTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.ListTenantsUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValueInitializer
import com.dsbuilder.ds.themes.application.UpdateTenantUseCase
import com.dsbuilder.ds.themes.data.ExposedTenantRepository
import com.dsbuilder.ds.themes.data.GeneratedTenantTokenValueInitializer
import org.koin.dsl.module

/** Dependency bindings owned by the themes feature. */
val themesModule = module {
    single<TenantRepository> { ExposedTenantRepository() }
    single<TenantTokenValueInitializer> { GeneratedTenantTokenValueInitializer() }
    factory { ListTenantsUseCase(get(), get(), get()) }
    factory { GetTenantUseCase(get(), get(), get()) }
    factory { CreateTenantUseCase(get(), get(), get(), get(), get()) }
    factory { UpdateTenantUseCase(get(), get(), get()) }
    factory { DeleteTenantUseCase(get(), get(), get()) }
    factory { GetTenantTokenValuesUseCase(get(), get(), get()) }
    factory { SaveTenantTokenValuesUseCase(get(), get(), get()) }
}
