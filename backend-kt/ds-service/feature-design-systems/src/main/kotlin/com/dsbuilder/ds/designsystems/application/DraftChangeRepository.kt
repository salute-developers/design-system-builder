package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import java.util.UUID

/** Читает вычисляемые изменения и откатывает редакции активного черновика. */
interface DraftChangeRepository {
    /** Вычисляет журнал активного черновика или указанной публикации. */
    suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): List<DraftChange>?

    /** Проверяет, содержит ли выбранный активный черновик хотя бы одно предметное изменение. */
    suspend fun hasChanges(projectId: ProjectId, designSystemId: DesignSystemId): Boolean?

    /** Откатывает актуальную черновую редакцию одной устойчивой сущности. */
    suspend fun revert(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        paths: Set<String> = emptySet(),
    ): DraftChangeRevertResult
}
