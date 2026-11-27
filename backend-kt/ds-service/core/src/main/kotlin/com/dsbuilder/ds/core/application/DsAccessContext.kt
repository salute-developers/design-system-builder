package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.ProjectId

/** Полномочия проекта либо адресная попытка чтения; публичность решается транзакционно. */
sealed interface DsAccessContext {
    /** Проект выбранного запроса; сам по себе не подтверждает членство или права. */
    val projectId: ProjectId
}
