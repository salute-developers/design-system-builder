package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.palette.SystemPaletteGroup
import java.util.UUID

/**
 * Снимок палитры темы; если у темы ещё нет копии шаблона или системных групп (тема создана в обход `ds-service`),
 * они создаются в текущей транзакции. `null` — тема недоступна проекту.
 */
internal suspend fun TenantPaletteRepository.initializedSnapshot(
    projectId: ProjectId,
    tenantId: UUID,
): TenantPaletteSnapshot? {
    val snapshot = snapshot(projectId, tenantId) ?: return null
    val systemGroups = snapshot.state.groups.count { it.systemKey != null }
    val complete = snapshot.state.template.isNotEmpty() && systemGroups == SYSTEM_GROUPS
    if (complete) return snapshot
    initialize(tenantId)
    return snapshot(projectId, tenantId)
}

private val SYSTEM_GROUPS = SystemPaletteGroup.entries.size
