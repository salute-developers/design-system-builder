package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Токен-ссылки итоговых свойств конфигурации. */
@Serializable
data class ComponentTokenReferencesResponse(
    /** Проверенные ссылки на токены. */ val items: List<ComponentTokenReferenceResponse>,
)
