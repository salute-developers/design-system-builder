package com.dsbuilder.ds.core.application

import java.util.UUID

/** Безопасные фактические метаданные одной транзакции чтения.
 * @property designSystemId Фактическая DS ресурса.
 * @property version Номер публикации или draft.
 * @property versionId Идентификатор опубликованной границы.
 * @property draftId Идентификатор активного черновика.
 * @property draftRevision Ревизия черновика в текущей транзакции.
 */
data class ModelReadContext(
    val designSystemId: UUID,
    val version: String? = null,
    val versionId: UUID? = null,
    val draftId: UUID? = null,
    val draftRevision: Long? = null,
)
