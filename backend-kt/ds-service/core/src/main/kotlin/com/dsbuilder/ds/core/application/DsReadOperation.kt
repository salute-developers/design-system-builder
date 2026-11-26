package com.dsbuilder.ds.core.application

/** Неизменяемый описатель, загружаемый из OpenAPI. */
data class DsReadOperation(
    /** Канонический HTTP-метод в верхнем регистре; запись не допускается. */
    val method: String,
    /** Полный внутренний шаблон маршрута с designSystemId из пути. */
    val path: String,
    /** Существующий read-scope; публичный доступ не создаёт новых проектных прав. */
    val permission: String,
    /** Форма метаданных: одна граница, история либо точная публикация по ID. */
    val kind: DsPublicReadKind,
)
