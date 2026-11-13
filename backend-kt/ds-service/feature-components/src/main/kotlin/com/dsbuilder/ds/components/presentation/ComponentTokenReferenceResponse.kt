package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentTokenReference
import kotlinx.serialization.Serializable

/** Ссылка на токен в итоговом свойстве. */
@Serializable
data class ComponentTokenReferenceResponse(
    /** ID токена. */ val tokenId: String,
    /** Имя токена. */ val tokenName: String,
    /** ID свойства. */ val propertyId: String,
    /** Имя свойства. */ val propertyName: String,
    /** ID записи-источника. */ val sourceId: String,
    /** ID набора состояний. */ val stateSetId: String,
    /** Имена состояний. */ val states: List<String>,
    /** Путь использования. */ val usagePath: String,
) {
    companion object {
        /** Преобразует доменное значение в ответ. */
        fun from(value: ComponentTokenReference) = ComponentTokenReferenceResponse(
            value.tokenId.toString(),
            value.tokenName,
            value.propertyId.toString(),
            value.propertyName,
            value.sourceId.toString(),
            value.stateSetId.toString(),
            value.states,
            value.usagePath,
        )
    }
}
