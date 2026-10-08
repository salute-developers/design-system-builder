package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import java.util.UUID

/** Удаляет пользовательскую группу: растяжки уходят в Neutral, токены возвращаются к группе по умолчанию. */
class DeleteTenantPaletteGroupUseCase(private val mutator: TenantPaletteMutator) {
    /** Удаление группы [groupId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        groupId: String,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<Unit>> =
        mutator.mutate(context, tenantId, editRevision, { _: Unit, _ -> }) { state, palette ->
            PaletteOperations.deleteGroup(state, groupId, palette)
        }
}
