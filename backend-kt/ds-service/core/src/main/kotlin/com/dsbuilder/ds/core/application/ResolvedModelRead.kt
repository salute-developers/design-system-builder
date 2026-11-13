package com.dsbuilder.ds.core.application

/** Разрешённая граница и контекст, передаваемый предметному чтению.
 * @property context Контекст предметного чтения.
 * @property metadata Фактические метаданные границы.
 */
data class ResolvedModelRead(val context: DsRequestContext, val metadata: ModelReadContext)
