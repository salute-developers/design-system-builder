package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import java.util.UUID

/** Добавляет растяжку копии шаблона в группу палитры темы. */
class AddTenantPaletteRampUseCase(private val mutator: TenantPaletteMutator) {
    /** Растяжка [target] в группе. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteRampView>> =
        mutator.mutate(context, tenantId, editRevision, { _, after -> after.rampView(target) }) { state, palette ->
            PaletteOperations.addRamp(state, target.groupId, target.slot, palette)
        }
}
