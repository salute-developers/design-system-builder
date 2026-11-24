package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.PropertyStateSupport
import kotlinx.serialization.Serializable
import java.util.UUID

/** Признак поддержки состояний свойства. */
@Serializable
data class PropertyStateSupportResponse(
    /** Допустимые состояния. */
    val stateIds: List<String>,
    /** Допускается ли сочетание нескольких состояний. */
    val combinations: Boolean,
) {
    companion object {
        /** Ответ из доменного признака. */
        fun from(value: PropertyStateSupport) =
            PropertyStateSupportResponse(value.stateIds.map(UUID::toString), value.combinations)
    }
}
