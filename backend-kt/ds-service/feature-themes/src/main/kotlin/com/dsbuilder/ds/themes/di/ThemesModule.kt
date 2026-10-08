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
import com.dsbuilder.ds.themes.application.palette.AddTenantPaletteRampUseCase
import com.dsbuilder.ds.themes.application.palette.AssignTenantPaletteTokenGroupUseCase
import com.dsbuilder.ds.themes.application.palette.CreateTenantPaletteGroupUseCase
import com.dsbuilder.ds.themes.application.palette.DeleteTenantPaletteGroupUseCase
import com.dsbuilder.ds.themes.application.palette.GetTenantPaletteUseCase
import com.dsbuilder.ds.themes.application.palette.ListTenantPaletteLinksUseCase
import com.dsbuilder.ds.themes.application.palette.PreviewTenantPaletteRampRebuildUseCase
import com.dsbuilder.ds.themes.application.palette.RebuildTenantPaletteRampUseCase
import com.dsbuilder.ds.themes.application.palette.RemoveTenantPaletteRampUseCase
import com.dsbuilder.ds.themes.application.palette.RenameTenantPaletteGroupUseCase
import com.dsbuilder.ds.themes.application.palette.ReplaceTenantPaletteRampSourceUseCase
import com.dsbuilder.ds.themes.application.palette.TenantPaletteMutator
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteUseCases
import com.dsbuilder.ds.themes.application.palette.UpdateTenantPaletteStepUseCase
import com.dsbuilder.ds.themes.data.ExposedTenantPaletteRepository
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
    factory { GetTenantTokenValuesUseCase(get(), get(), get(), get()) }
    factory { SaveTenantTokenValuesUseCase(get(), get(), get()) }
    single<TenantPaletteRepository> { ExposedTenantPaletteRepository() }
    factory { TenantPaletteMutator(get(), get(), get()) }
    factory { GetTenantPaletteUseCase(get(), get(), get()) }
    factory { ListTenantPaletteLinksUseCase(get()) }
    factory { CreateTenantPaletteGroupUseCase(get(), get()) }
    factory { RenameTenantPaletteGroupUseCase(get()) }
    factory { DeleteTenantPaletteGroupUseCase(get()) }
    factory { AssignTenantPaletteTokenGroupUseCase(get()) }
    factory { AddTenantPaletteRampUseCase(get()) }
    factory { ReplaceTenantPaletteRampSourceUseCase(get()) }
    factory { RebuildTenantPaletteRampUseCase(get()) }
    factory { PreviewTenantPaletteRampRebuildUseCase(get()) }
    factory { UpdateTenantPaletteStepUseCase(get()) }
    factory { RemoveTenantPaletteRampUseCase(get(), get()) }
    factory {
        TenantPaletteUseCases(get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get())
    }
}
