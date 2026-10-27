package com.dsbuilder.ds.themes.application.typography

/** Use case стилей типографии для маршрутов `/api/ds/tenants/{tenantId}/typography-styles`. */
data class TypographyStyleUseCases(
    /** Чтение стилей темы. */
    val get: GetTypographyStylesUseCase,
    /** Изменение стиля. */
    val update: UpdateTypographyStyleUseCase,
)
