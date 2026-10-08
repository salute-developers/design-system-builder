package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdGenerator
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupView
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import java.util.UUID

/** Создаёт пользовательскую группу палитры темы. */
class CreateTenantPaletteGroupUseCase(private val mutator: TenantPaletteMutator, private val ids: IdGenerator) {
    /** Новая группа с названием [label]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        label: String,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteGroupView>> =
        mutator.mutate(context, tenantId, editRevision, { group, after -> after.groupView(group.id) }) { state, _ ->
            PaletteOperations.createGroup(state, label) { ids.next().toString() }
        }
}
