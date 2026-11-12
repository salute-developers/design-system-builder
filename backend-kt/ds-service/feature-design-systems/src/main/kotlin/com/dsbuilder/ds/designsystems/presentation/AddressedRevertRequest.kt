package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Адресная команда полного пакетного отката. */
@Serializable
data class AddressedRevertRequest(
    /** Черновик, выбранный пользователем. */
    val draftId: String,
    /** Адреса в порядке отката. */
    val targets: List<AddressedRevertTargetRequest>,
)
