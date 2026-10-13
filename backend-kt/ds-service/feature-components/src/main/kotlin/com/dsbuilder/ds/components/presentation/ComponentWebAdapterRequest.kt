package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса web-адаптера. */
@Serializable
data class ComponentWebAdapterRequest(
    /** Дизайн-система, данные которой выгружаются. */
    val designSystemId: String,
)
