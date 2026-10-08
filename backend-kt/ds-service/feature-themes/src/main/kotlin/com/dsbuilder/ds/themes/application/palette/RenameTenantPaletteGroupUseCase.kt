package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupView
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import java.util.UUID

/** Переименовывает пользовательскую группу палитры темы. */
class RenameTenantPaletteGroupUseCase(private val mutator: TenantPaletteMutator) {
    /** Новое название [label] группы [groupId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        groupId: String,
        label: String,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteGroupView>> =
        mutator.mutate(context, tenantId, editRevision, { group, after -> after.groupView(group.id) }) { state, _ ->
            PaletteOperations.renameGroup(state, groupId, label)
        }
}
