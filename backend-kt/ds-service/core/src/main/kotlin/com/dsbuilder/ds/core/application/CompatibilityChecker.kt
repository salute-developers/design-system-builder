package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Общий порт проверки для публикации и экспорта без зависимости feature-модулей друг от друга. */
fun interface CompatibilityChecker {
    /** Проверяет все активные назначения, включая отсутствующие в текущем Core. */
    suspend fun check(projectId: ProjectId, designSystemId: UUID, versionId: UUID?): CoreCompatibilityReport
}

/** Один отказ используется публикацией и новым экспортом. */
fun CoreCompatibilityReport.conflict(
    projectId: com.dsbuilder.ds.core.domain.ProjectId,
): DsFailure.Conflict = DsFailure.Conflict(
    code = "CORE_COMPATIBILITY_CONFLICT",
    coreContext = context,
    blockingCount = blockingCount,
    compatibilityPath = "/api/projects/${projectId.value}/design-systems/${context.designSystemId}/compatibility",
)
