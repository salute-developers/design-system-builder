package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import java.util.UUID

/** Правка одной ступени растяжки в группе; значение источника снимает правку. */
class UpdateTenantPaletteStepUseCase(private val mutator: TenantPaletteMutator) {
    /** Значение [value] ступени [step] растяжки [target]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        step: Int,
        value: String,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<PaletteRampView>> =
        mutator.mutate(context, tenantId, editRevision, { _, after -> after.rampView(target) }) { state, palette ->
            PaletteOperations.updateStep(state, target.groupId, target.slot, step, value, palette)
        }
}
