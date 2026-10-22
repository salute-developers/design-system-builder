package com.dsbuilder.ds.tokens.di

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TokenRevertListener
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
import com.dsbuilder.ds.tokens.data.TOKEN_DRAFT_ENTITY_TYPE
import com.dsbuilder.ds.tokens.data.TOKEN_VALUE_DRAFT_ENTITY_TYPE
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import org.koin.core.qualifier.named
import org.koin.dsl.module

/** Dependency bindings owned by the tokens feature. */
val tokensModule = module {
    // Слушатели отката значения объявляют другие фичи, поэтому обработчики создаются лениво.
    listOf(TOKEN_DRAFT_ENTITY_TYPE, TOKEN_VALUE_DRAFT_ENTITY_TYPE).forEach { entityType ->
        single<DraftChangeHandler>(named(entityType)) {
            tokenDraftChangeHandlers(getAll<TokenRevertListener>()).single { it.entityType == entityType }
        }
    }
    single<TokenRepository> { ExposedTokenRepository(getAll()) }
    single<TokenValueRepository> { ExposedTokenValueRepository() }
    single<PaletteRepository> { ExposedPaletteRepository() }
    single<DesignSystemTokenInitializer> { GeneratedTokenDefinitionInitializer(get()) }
    factory { ListTokensUseCase(get(), get(), get()) }
    factory { GetTokenUseCase(get(), get(), get()) }
    factory { CreateTokenUseCase(get(), get(), get(), IdempotentCreateExecutor(get()), get()) }
    factory { UpdateTokenUseCase(get(), get(), get(), get()) }
    factory { DeleteTokenUseCase(get(), get(), get()) }
    factory { GetTokenValuesUseCase(get(), get(), get(), getAll()) }
    factory { ListTokenValuesUseCase(get(), get(), get(), getAll()) }
    factory { GetTokenValueUseCase(get(), get(), get(), getAll()) }
    factory { CreateTokenValueUseCase(get(), get(), get(), IdempotentCreateExecutor(get()), get(), getAll()) }
    factory { UpdateTokenValueUseCase(get(), get(), get(), getAll()) }
    factory { DeleteTokenValueUseCase(get(), get(), get(), getAll()) }
    factory { ListPaletteUseCase(get(), get(), get()) }
    factory { GetPaletteEntryUseCase(get(), get(), get()) }
    factory { ListPaletteByTypeUseCase(get(), get(), get()) }
    factory { CreatePaletteEntryUseCase(get(), get(), get(), get()) }
    factory { UpdatePaletteEntryUseCase(get(), get(), get()) }
    factory { DeletePaletteEntryUseCase(get(), get(), get()) }
}
