package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.palette.TokenReferenceRewrite
import java.util.UUID

/**
 * Хранилище палитры в памяти: одна тема со снимком [snapshot], записи и переписывания ссылок запоминаются;
 * [initialized] — снимок после `initialize` (тема без палитры получает её при первом обращении).
 */
internal class FakeTenantPaletteRepository(
    var snapshot: TenantPaletteSnapshot?,
    private val initialized: TenantPaletteSnapshot? = null,
) : TenantPaletteRepository {
    var initializedTenant: UUID? = null
    var saved: TenantPaletteState? = null
    var rewrite: TokenReferenceRewrite? = null
    var resolveHex: ((Int) -> String?)? = null

    override suspend fun initialize(tenantId: UUID) {
        initializedTenant = tenantId
        initialized?.let { snapshot = it }
    }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TenantPaletteLock {
        // Как в базе: изменять можно только тему дизайн-системы своего проекта.
        val current = snapshot?.takeIf { it.owned } ?: return TenantPaletteLock.NotFound
        return if (current.state.editRevision == editRevision) {
            TenantPaletteLock.Locked
        } else {
            TenantPaletteLock.RevisionConflict(current.state.editRevision)
        }
    }

    override suspend fun snapshot(projectId: ProjectId, tenantId: UUID) = snapshot

    override suspend fun save(tenantId: UUID, state: TenantPaletteState) {
        saved = state
        snapshot = snapshot?.copy(state = state)
    }

    override suspend fun rewriteTokenReferences(
        tenantId: UUID,
        rewrite: TokenReferenceRewrite,
        resolveHex: (Int) -> String?,
    ): Int {
        this.rewrite = rewrite
        this.resolveHex = resolveHex
        return rewrite.tokenIds.size
    }
}
