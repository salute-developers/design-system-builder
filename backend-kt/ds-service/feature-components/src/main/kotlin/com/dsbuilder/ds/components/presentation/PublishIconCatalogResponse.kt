package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.PublishIconCatalogResult
import kotlinx.serialization.Serializable

/** Ответ загрузки каталога. */
@Serializable
data class PublishIconCatalogResponse(
    /** `published`, `unchanged` или `activated`. */
    val outcome: String,
    /** Была ли загрузка пробной. */
    val dryRun: Boolean,
    /** Идентификатор загрузки. */
    val loadId: String,
    /** Счётчики. */
    val counts: IconCountsDto,
    /** Добавленные имена, не более 200. */
    val added: List<String>,
    /** Удалённые имена, не более 200. */
    val removed: List<String>,
    /** Изменённые имена, не более 200. */
    val changed: List<String>,
    /** Усечён ли хотя бы один список. */
    val truncated: Boolean,
    /** Удаляемые используемые иконки. */
    val removedInUse: List<RemovedIconInUseDto>,
    /** Отчёт сверки. */
    val reconciliation: IconReconciliationDto,
) {
    /** Сборка ответа. */
    companion object {
        /** Преобразует результат в ответ. */
        fun from(value: PublishIconCatalogResult) = PublishIconCatalogResponse(
            outcome = value.outcome.wire,
            dryRun = value.dryRun,
            loadId = value.loadId,
            counts = IconCountsDto(value.diff.added, value.diff.removed, value.diff.changed, value.diff.unchanged),
            added = value.diff.addedNames,
            removed = value.diff.removedNames,
            changed = value.diff.changedNames,
            truncated = value.diff.truncated,
            removedInUse = value.removedInUse.map { RemovedIconInUseDto(it.name, it.sizes, it.references) },
            reconciliation = IconReconciliationDto(
                value.reconciliation.resolved,
                value.reconciliation.unresolved,
                value.reconciliation.unresolvedValues,
            ),
        )
    }
}
