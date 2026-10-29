package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import java.util.UUID

/** «Поменять»: новый источник растяжки только в одной группе. */
class ReplaceTenantPaletteRampSourceUseCase(private val mutator: TenantPaletteMutator) {
    /** Источник [source] растяжки [target]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        source: PaletteRampRef,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteRampView>> =
        mutator.mutate(context, tenantId, editRevision, { _, after -> after.rampView(target) }) { state, palette ->
            PaletteOperations.replaceSource(state, target.groupId, target.slot, source, palette)
        }
}
