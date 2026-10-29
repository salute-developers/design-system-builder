package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteLink
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import java.util.UUID

/** Связи токенов темы со слотом: во всех группах или в одной, для всей растяжки или одной ступени. */
class ListTenantPaletteLinksUseCase(private val palette: GetTenantPaletteUseCase) {
    /** Связи слота [slot] с необязательными фильтрами по группе и ступени. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        slot: PaletteRampRef,
        groupId: String?,
        step: Int?,
    ): DsResult<List<PaletteLink>> = when (val result = palette.execute(context, tenantId)) {
        is DsResult.Failure -> result
        is DsResult.Success -> DsResult.Success(
            result.value.links.filter { link ->
                link.slot == slot && (groupId == null || link.groupId == groupId) && (step == null || link.step == step)
            },
        )
    }
}
