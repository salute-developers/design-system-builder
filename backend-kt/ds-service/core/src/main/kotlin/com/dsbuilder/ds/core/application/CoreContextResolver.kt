package com.dsbuilder.ds.core.application

import java.util.UUID

/** Разрешённое происхождение API одной платформы выбранной границы. */
typealias ResolvedCoreRelease = com.dsbuilder.ds.core.domain.CoreReleaseSnapshot

/** Общий порт Core-контекста, доступный компонентам и публикации без зависимости между feature-модулями. */
fun interface CoreContextResolver {
    /** Возвращает согласованный набор после проверки доступа к границе. */
    suspend fun resolve(versionId: UUID?): List<ResolvedCoreRelease>
}
