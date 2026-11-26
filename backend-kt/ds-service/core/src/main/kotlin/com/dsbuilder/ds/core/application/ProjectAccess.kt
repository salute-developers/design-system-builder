package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.domain.ProjectId

/** Проектный доступ делегирует существующему authorization-core без новых ролей. */
data class ProjectAccess(
    /** Настоящие полномочия из существующей проектной авторизации. */
    val principal: ProjectPrincipal,
) : DsAccessContext {
    /** Проект подтверждённых полномочий. */
    override val projectId: ProjectId get() = ProjectId(principal.projectId)
}
