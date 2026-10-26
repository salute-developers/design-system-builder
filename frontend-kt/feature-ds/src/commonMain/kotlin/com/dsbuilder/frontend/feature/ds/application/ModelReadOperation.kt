package com.dsbuilder.frontend.feature.ds.application

/** Простые чтения авторитетной модели; составной экспорт имеет собственный сценарий. */
public enum class ModelReadOperation {
    CONTEXT, VERSIONS, VERSION, CHANGES, TENANTS, TOKENS, TOKEN, TOKEN_VALUES,
    TOKEN_GROUPS, PALETTE, COMPONENTS, COMPONENT, COMPONENT_STYLES, APPEARANCE_VARIATIONS,
}
