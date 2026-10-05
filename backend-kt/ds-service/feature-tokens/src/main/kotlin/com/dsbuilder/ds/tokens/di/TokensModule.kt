package com.dsbuilder.ds.tokens.di

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.tokens.application.CreatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.CreateTokenUseCase
import com.dsbuilder.ds.tokens.application.CreateTokenValueUseCase
import com.dsbuilder.ds.tokens.application.DeletePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetPaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteByTypeUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteUseCase
import com.dsbuilder.ds.tokens.application.ListTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListTokensUseCase
import com.dsbuilder.ds.tokens.application.PaletteRepository
import com.dsbuilder.ds.tokens.application.TokenRepository
import com.dsbuilder.ds.tokens.application.TokenValueRepository
import com.dsbuilder.ds.tokens.application.UpdatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenValueUseCase
import com.dsbuilder.ds.tokens.data.ExposedPaletteRepository
import com.dsbuilder.ds.tokens.data.ExposedTokenRepository
import com.dsbuilder.ds.tokens.data.ExposedTokenValueRepository
import com.dsbuilder.ds.tokens.data.GeneratedTokenDefinitionInitializer
import org.koin.dsl.module

/** Dependency bindings owned by the tokens feature. */
val tokensModule = module {
    single<TokenRepository> { ExposedTokenRepository() }
    single<TokenValueRepository> { ExposedTokenValueRepository() }
    single<PaletteRepository> { ExposedPaletteRepository() }
    single<DesignSystemTokenInitializer> { GeneratedTokenDefinitionInitializer() }
    factory { ListTokensUseCase(get(), get(), get()) }
    factory { GetTokenUseCase(get(), get(), get()) }
    factory { CreateTokenUseCase(get(), get(), get()) }
    factory { UpdateTokenUseCase(get(), get(), get()) }
    factory { DeleteTokenUseCase(get(), get(), get()) }
    factory { GetTokenValuesUseCase(get(), get(), get()) }
    factory { ListTokenValuesUseCase(get(), get(), get()) }
    factory { GetTokenValueUseCase(get(), get(), get()) }
    factory { CreateTokenValueUseCase(get(), get(), get()) }
    factory { UpdateTokenValueUseCase(get(), get(), get()) }
    factory { DeleteTokenValueUseCase(get(), get(), get()) }
    factory { ListPaletteUseCase(get(), get(), get()) }
    factory { GetPaletteEntryUseCase(get(), get(), get()) }
    factory { ListPaletteByTypeUseCase(get(), get(), get()) }
    factory { CreatePaletteEntryUseCase(get(), get(), get()) }
    factory { UpdatePaletteEntryUseCase(get(), get(), get()) }
    factory { DeletePaletteEntryUseCase(get(), get(), get()) }
}
