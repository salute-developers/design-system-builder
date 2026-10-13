package com.dsbuilder.ds.themes.application.colortokens

/** Use case цветовых токенов для маршрутов `/api/ds/tenants/{tenantId}/color-tokens`. */
data class ColorTokenUseCases(
    /** Создание токена. */
    val create: CreateColorTokenUseCase,
    /** Замена значений токена в теме. */
    val updateValues: UpdateColorTokenValuesUseCase,
    /** Удаление токена. */
    val delete: DeleteColorTokenUseCase,
)
