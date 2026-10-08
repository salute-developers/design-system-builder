package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.RemoveRampStrategy
import com.dsbuilder.ds.themes.domain.palette.RemovedRamp
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import java.util.UUID

/**
 * Удаление растяжки из группы. Связанные токены группы переходят на ту же ступень замены или получают HEX
 * текущего значения ступени — в той же транзакции.
 */
class RemoveTenantPaletteRampUseCase(
    private val mutator: TenantPaletteMutator,
    private val repository: TenantPaletteRepository,
) {
    /** Удаляет растяжку [target]; при связанных токенах нужна стратегия [strategy]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        target: TenantPaletteRampTarget,
        strategy: RemoveRampStrategy?,
        replacement: PaletteRampRef?,
        editRevision: Int,
    ): DsResult<TenantPaletteMutation<RemovedRamp>> {
        val rewriteLinks: suspend (RemovedRamp, ThemePalette) -> Unit = { removed, palette ->
            removed.rewrite?.let { rewrite ->
                // Как вычисляется цвет токена: ступень растяжки группы, иначе копия шаблона слота — так ссылка на
                // ступень, которой нет у источника, тоже становится HEX и не остаётся на убранном слоте.
                repository.rewriteTokenReferences(tenantId, rewrite) { step ->
                    ThemePaletteResolver.stepInGroup(palette, target.groupId, target.slot, step)
                }
            }
        }
        return mutator.mutate(
            context,
            tenantId,
            editRevision,
            { removed, _ -> removed },
            rewriteLinks,
        ) { state, palette ->
            PaletteOperations.removeRamp(state, target.groupId, target.slot, strategy, replacement, palette)
        }
    }
}
