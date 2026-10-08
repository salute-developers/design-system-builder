package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import java.util.UUID

/** «Изменить»: перестройка растяжки в группе от опорного цвета. */
class RebuildTenantPaletteRampUseCase(private val mutator: TenantPaletteMutator) {
    /** Перестраивает [target] от опорного цвета [anchor]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        anchor: PaletteAnchor,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteRampView>> =
        mutator.mutate(context, tenantId, editRevision, { _, after -> after.rampView(target) }) { state, palette ->
            PaletteOperations.rebuild(state, target.groupId, target.slot, anchor.step, anchor.value, palette)
        }
}
