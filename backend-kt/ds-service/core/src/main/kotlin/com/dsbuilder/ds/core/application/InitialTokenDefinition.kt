package com.dsbuilder.ds.core.application

/** Минимальные исходные данные для классификации определения без зависимости от модуля токенов. */
data class InitialTokenDefinition(
    /** Устойчивое предметное имя определения. */
    val name: String,
    /** Тип токена в публичном формате. */
    val type: String,
)
