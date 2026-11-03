package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadQuery
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

    /** Считает отображаемые строки порциями, независимо от предела полного журнала. */
    suspend fun summary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): Int? = error("Compact journal projection is not implemented")

    /** Возвращает только уникальные ID видимо изменённых токенов выбранной темы. */
    suspend fun changedTokenIds(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        tenantId: UUID,
    ): Set<UUID>? = error("Compact token projection is not implemented")

    /** Сохраняет предел вычисления журнала до применения страницы. */
    suspend fun page(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        read: ModelReadQuery,
    ): ModelReadItems<DraftChange>? = list(projectId, systemAdmin, designSystemId, versionId)
        ?.let { ModelReadItems(it) }

    /** Журнал вместе с точным числом отображаемых строк той же границы чтения. */
    suspend fun pageAndSummary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        read: ModelReadQuery,
    ): DraftJournalRead? =
        page(projectId, systemAdmin, designSystemId, versionId, read)?.let {
            DraftJournalRead(it, null)
        }

    /** Проверяет, содержит ли выбранный активный черновик хотя бы одно предметное изменение. */
    suspend fun hasChanges(projectId: ProjectId, designSystemId: DesignSystemId): Boolean?

    /**
     * Текущая техническая редакция записи [changeId] активного черновика — та же, что `editRevision` журнала.
     * `null` — записи нет (или нет доступа); при превышении защитного предела журнала бросает
     * [DraftChangeLimitExceededException]. Ничего не блокирует: изменение записи после чтения обнаружит
     * сериализуемая транзакция вызывающего.
     */
    suspend fun currentRevision(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
    ): Long? = error("Draft change revision lookup is not implemented")

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
