package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import java.util.UUID

/** Значения ступеней перестройки растяжки без изменения палитры и ревизии. */
class PreviewTenantPaletteRampRebuildUseCase(private val mutator: TenantPaletteMutator) {
    /** Ступени [target] после перестройки от опорного цвета [anchor] по возрастанию. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        anchor: PaletteAnchor,
        editRevision: Int,
    ): DsResult<List<Pair<Int, String>>> = when (
        val result = mutator.preview(context, tenantId, editRevision) { state, palette ->
            PaletteOperations.rebuildPreview(state, target.groupId, target.slot, anchor.step, anchor.value, palette)
        }
    ) {
        is DsResult.Failure -> result
        is DsResult.Success -> DsResult.Success(result.value.toSortedMap().toList())
    }
}
