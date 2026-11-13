package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.domain.ProjectId

/** Порт атомарного исправления через существующие предметные редакции. */
fun interface CoreProblemRepairRepository {
    /** Не меняет источник или цель при конфликте. */
    suspend fun repair(projectId: ProjectId, admin: Boolean, command: RepairCoreProblem): DsResult<Unit>
}
