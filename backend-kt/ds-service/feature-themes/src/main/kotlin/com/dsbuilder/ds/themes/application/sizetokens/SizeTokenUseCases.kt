package com.dsbuilder.ds.themes.application.sizetokens

/** Use case токенов размеров для маршрутов `/api/ds/tenants/{tenantId}/size-tokens`. */
data class SizeTokenUseCases(
    /** Чтение раздела. */
    val get: GetSizeTokensUseCase,
    /** Замена значения токена в теме. */
    val updateValue: UpdateSizeTokenValueUseCase,
    /** Создание токена. */
    val create: CreateSizeTokenUseCase,
    /** Удаление токена. */
    val delete: DeleteSizeTokenUseCase,
)
