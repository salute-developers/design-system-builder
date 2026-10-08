package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenAssignment
import java.util.UUID

/** Явно привязывает цветовой токен к группе палитры или сбрасывает привязку (`groupId = null`). */
class AssignTenantPaletteTokenGroupUseCase(private val mutator: TenantPaletteMutator) {
    /** Привязка токена [tokenId] к группе [groupId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: String,
        groupId: String?,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteTokenAssignment>> =
        mutator.mutate(context, tenantId, editRevision, { id, after -> after.assignmentOf(id) }) { state, palette ->
            PaletteOperations.assignTokenGroup(state, tokenId, groupId, palette)
        }
}
