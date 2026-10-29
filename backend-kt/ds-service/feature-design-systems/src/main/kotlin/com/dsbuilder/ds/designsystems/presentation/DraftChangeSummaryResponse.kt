package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Компактная сводка оболочки, без предметных значений и записей журнала. */
@Serializable
data class DraftChangeSummaryResponse(/** Число строк журнала после разделения параметров. */ val total: Int)
