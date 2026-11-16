package com.dsbuilder.ds.core.application

import java.util.UUID

/** Узкий отбор кандидатов; несовместимые политики и обработчики сохраняют прежний обход. */
interface JournalCandidateProjection {
    /** Тип сущности, подробности которой получит существующий обработчик. */
    val entityType: String

    /** Типы с изменениями, необходимые для применения проекции. */
    val requiredChangedTypes: Set<String>

    /** Разрешают ли все активные политики раннее исключение кандидатов. */
    fun supports(policies: List<DraftChangePolicy>): Boolean

    /** Передаёт ограниченные порции кандидатов в текущей транзакции без изменения данных. */
    fun visit(scope: JournalProjectionScope, consume: (List<UUID>) -> Unit)
}
