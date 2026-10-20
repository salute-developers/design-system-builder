package com.dsbuilder.ds.core.application

import java.util.UUID

/** Создаёт исходные группы перед записью исходных определений токенов, до появления черновика. */
fun interface DesignSystemTokenPlacementInitializer {
    /** Возвращает места определений по устойчивому предметному имени. */
    suspend fun initialize(
        designSystemId: UUID,
        definitions: List<InitialTokenDefinition>,
    ): Map<String, InitialTokenPlacement>
}
