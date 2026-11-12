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
    /** Отменяет переданные адреса без разрешения changeId через общий журнал. */
    suspend fun revertAddressed(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        draftId: UUID,
        targets: List<DraftAddressTarget>,
    ): com.dsbuilder.ds.core.application.DsResult<Unit>

    /** Читает цели только выбранных токенов и их значений одной темы. */
    suspend fun tokenTargets(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        draftId: UUID,
        tenantId: UUID,
        tokenIds: Set<UUID>,
        cursor: String?,
    ): com.dsbuilder.ds.core.application.DsResult<DraftTokenTargetPage>

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
    ): Int?

    /** Возвращает только уникальные ID видимо изменённых токенов выбранной темы. */
    suspend fun changedTokenIds(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        tenantId: UUID,
    ): Set<UUID>?

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
     * Откатывает записи [changes] активного черновика одним пакетом в присланном порядке (от новой к старой).
     * Сначала все записи сверяются с редакциями снимка журнала клиента — до первого отката; затем записи
     * откатываются по редакции на своём шаге, а запись, исчезнувшая из-за предыдущих откатов пакета, считается
     * отменённой. Предметные действия после отката, проверка зависимостей и ограничений выполняются один раз для
     * итогового состояния. При отказе вызывающий откатывает транзакцию.
     */
    suspend fun revertAll(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
    ): DraftChangeBatchRevertResult = error("Batch draft change revert is not implemented")

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
