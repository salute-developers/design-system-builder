package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Проверенная ссылка на токен в итоговом свойстве конфигурации. */
data class ComponentTokenReference(
    /** Идентификатор токена. */
    val tokenId: UUID,
    /** Имя токена. */
    val tokenName: String,
    /** Идентификатор свойства. */
    val propertyId: UUID,
    /** Имя свойства. */
    val propertyName: String,
    /** Идентификатор записи-источника. */
    val sourceId: UUID,
    /** Идентификатор набора состояний. */
    val stateSetId: UUID,
    /** Имена состояний. */
    val states: List<String>,
    /** Путь использования внутри конфигурации. */
    val usagePath: String,
)
