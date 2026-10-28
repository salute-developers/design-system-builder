package com.dsbuilder.ds.themes.di

import com.dsbuilder.ds.core.application.DesignSystemTokenPlacementInitializer
import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TokenRevertListener
import com.dsbuilder.ds.core.application.TokenValueReadPolicy
import com.dsbuilder.ds.core.application.TokenValueWritePolicy
import com.dsbuilder.ds.themes.application.CreateTenantUseCase
import com.dsbuilder.ds.themes.application.DeleteTenantUseCase
import com.dsbuilder.ds.themes.application.GetTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.ListTenantsUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValueInitializer
import com.dsbuilder.ds.themes.application.UpdateTenantUseCase
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenFamilyTypeSync
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRevertListener
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenUseCases
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValueReadPolicy
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValueWritePolicy
import com.dsbuilder.ds.themes.application.colortokens.CreateColorTokenUseCase
import com.dsbuilder.ds.themes.application.colortokens.DeleteColorTokenUseCase
import com.dsbuilder.ds.themes.application.colortokens.MoveColorTokenUseCase
import com.dsbuilder.ds.themes.application.colortokens.UpdateColorTokenValuesUseCase
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
import com.dsbuilder.ds.themes.application.sizetokens.CreateSizeTokenUseCase
import com.dsbuilder.ds.themes.application.sizetokens.DeleteSizeTokenUseCase
import com.dsbuilder.ds.themes.application.sizetokens.GetSizeTokensUseCase
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenRepository
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUsageRepository
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUseCases
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValueUseCase
import com.dsbuilder.ds.themes.application.tokengroups.CreateTokenGroupUseCase
import com.dsbuilder.ds.themes.application.tokengroups.DeleteTokenGroupUseCase
import com.dsbuilder.ds.themes.application.tokengroups.ListTokenGroupsUseCase
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupUseCases
import com.dsbuilder.ds.themes.application.tokengroups.UpdateTokenGroupUseCase
import com.dsbuilder.ds.themes.application.typography.GetTypographyStylesUseCase
import com.dsbuilder.ds.themes.application.typography.TypographyStyleRepository
import com.dsbuilder.ds.themes.application.typography.TypographyStyleUseCases
import com.dsbuilder.ds.themes.application.typography.TypographyUsageRepository
import com.dsbuilder.ds.themes.application.typography.UpdateTypographyStyleUseCase
import com.dsbuilder.ds.themes.data.ExposedColorTokenRepository
import com.dsbuilder.ds.themes.data.ExposedSizeTokenRepository
import com.dsbuilder.ds.themes.data.ExposedSizeTokenUsageRepository
import com.dsbuilder.ds.themes.data.ExposedTenantPaletteRepository
import com.dsbuilder.ds.themes.data.ExposedTenantRepository
import com.dsbuilder.ds.themes.data.ExposedTokenGroupRepository
import com.dsbuilder.ds.themes.data.ExposedTypographyStyleRepository
import com.dsbuilder.ds.themes.data.ExposedTypographyUsageRepository
import com.dsbuilder.ds.themes.data.GeneratedTenantTokenValueInitializer
import com.dsbuilder.ds.themes.data.InitialTokenPlacementInitializer
import com.dsbuilder.ds.themes.data.PaletteRevertDependencyValidator
import com.dsbuilder.ds.themes.data.TENANT_ENTITY_TYPE
import com.dsbuilder.ds.themes.data.paletteDraftChangeHandlers
import com.dsbuilder.ds.themes.data.tenantDraftChangeHandler
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import org.koin.core.qualifier.named
import org.koin.dsl.module

/** Dependency bindings owned by the themes feature. */
val themesModule = module {
    single<DesignSystemTokenPlacementInitializer> { InitialTokenPlacementInitializer() }
    // Обработчик отката темы пересчитывает тип семейств цветовых токенов и получает зависимость лениво; обработчики
    // палитры зависимостей не имеют и регистрируются под своими типами сущностей.
    single<DraftChangeHandler>(named(TENANT_ENTITY_TYPE)) { tenantDraftChangeHandler(get()) }
    paletteDraftChangeHandlers().forEach { handler ->
        single<DraftChangeHandler>(named(handler.entityType)) { handler }
    }
    single<DraftChangePolicy>(named("theme-journal")) { themeDraftChangePolicy() }
    single<DraftChangeDependencyValidator>(named("palette-revert")) { PaletteRevertDependencyValidator() }
    single<TenantRepository> { ExposedTenantRepository() }
    single<TenantTokenValueInitializer> { GeneratedTenantTokenValueInitializer() }
    factory { ListTenantsUseCase(get(), get(), get()) }
    factory { GetTenantUseCase(get(), get(), get()) }
    factory {
        CreateTenantUseCase(
            get(),
            get(),
            get(),
            get(),
            get(),
            IdempotentCreateExecutor(
                get(),
            ),
            get(),
            get(),
        )
    }
    factory { UpdateTenantUseCase(get(), get(), get(), get()) }
    factory { DeleteTenantUseCase(get(), get(), get(), get()) }
    factory { GetTenantTokenValuesUseCase(get(), get(), get(), get()) }
    factory { SaveTenantTokenValuesUseCase(get(), get(), get(), get(), get()) }
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
    single<ColorTokenRepository> { ExposedColorTokenRepository(getAll()) }
    factory { ColorTokenFamilyTypeSync(get()) }
    single<TokenRevertListener>(named("color-token-type")) { ColorTokenRevertListener(get()) }
    single<TokenValueWritePolicy>(named("color-token-values")) { ColorTokenValueWritePolicy(get(), get(), get()) }
    single<TokenValueReadPolicy>(named("color-token-values")) { ColorTokenValueReadPolicy(get(), get()) }
    single<TokenGroupRepository> { ExposedTokenGroupRepository() }
    factory { CreateColorTokenUseCase(get(), get(), get(), get(), get(), get()) }
    factory { UpdateColorTokenValuesUseCase(get(), get(), get(), get(), get()) }
    factory { DeleteColorTokenUseCase(get(), get(), get()) }
    factory { MoveColorTokenUseCase(get(), get(), get(), get()) }
    factory { ColorTokenUseCases(get(), get(), get(), get()) }
    factory { ListTokenGroupsUseCase(get(), get(), get()) }
    factory { CreateTokenGroupUseCase(get(), get(), get(), get()) }
    factory { UpdateTokenGroupUseCase(get(), get(), get(), get()) }
    factory { DeleteTokenGroupUseCase(get(), get(), get(), get()) }
    factory { TokenGroupUseCases(get(), get(), get(), get()) }
    single<SizeTokenRepository> { ExposedSizeTokenRepository(getAll()) }
    single<SizeTokenUsageRepository> { ExposedSizeTokenUsageRepository() }
    factory { GetSizeTokensUseCase(get(), get(), get(), get(), get()) }
    factory { UpdateSizeTokenValueUseCase(get(), get(), get(), get(), get()) }
    factory { CreateSizeTokenUseCase(get(), get(), get(), get(), get(), get()) }
    factory { DeleteSizeTokenUseCase(get(), get(), get()) }
    factory { SizeTokenUseCases(get(), get(), get(), get()) }
    single<TypographyStyleRepository> { ExposedTypographyStyleRepository() }
    single<TypographyUsageRepository> { ExposedTypographyUsageRepository() }
    factory { GetTypographyStylesUseCase(get(), get(), get(), get()) }
    factory { UpdateTypographyStyleUseCase(get(), get(), get()) }
    factory { TypographyStyleUseCases(get(), get()) }
}
