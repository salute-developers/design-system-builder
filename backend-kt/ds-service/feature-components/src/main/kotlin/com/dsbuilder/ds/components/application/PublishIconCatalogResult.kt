package com.dsbuilder.ds.components.application

/** Результат загрузки. */
data class PublishIconCatalogResult(
    /** Итог. */
    val outcome: IconPublishOutcome,
    /** Была ли загрузка пробной. */
    val dryRun: Boolean,
    /** Идентификатор загрузки. */
    val loadId: String,
    /** Различия с активным каталогом. */
    val diff: IconCatalogDiff,
    /** Удаляемые иконки, на которые есть ссылки. */
    val removedInUse: List<RemovedIconInUse>,
    /** Отчёт сверки. */
    val reconciliation: IconReconciliation,
)
