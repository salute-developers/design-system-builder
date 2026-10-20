package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Не позволяет отменой вернуть значение удалённого токена или ссылку на недоступную растяжку. */
class PaletteRevertDependencyValidator : DraftChangeDependencyValidator {
    override suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean {
        if (entityType != "token-value") return true
        val stable = ThemeTokenValuesTable.selectAll().where {
            (ThemeTokenValuesTable.id eq entityId) and (ThemeTokenValuesTable.designSystemId eq designSystemId)
        }.singleOrNull() ?: return true
        return validRestoredValue(designSystemId, entityId, stable)
    }

    private suspend fun validRestoredValue(designSystemId: UUID, entityId: UUID, stable: ResultRow): Boolean {
        val tokenId = stable[ThemeTokenValuesTable.tokenId]
        val tokenRow = currentThemeTokenRows(designSystemId, setOf(tokenId)).singleOrNull() ?: return false
        val value = currentThemeTokenValueRows(
            designSystemId, setOf(stable[ThemeTokenValuesTable.tenantId]), setOf(tokenId),
        ).firstOrNull { it[ThemeTokenValuesTable.id] == entityId } ?: return true
        return tokenRow[ThemeTokenRevisionsTable.type] != ThemeTokenType.COLOR ||
            validColorReference(
                entityId, value[ThemeTokenValuesTable.tenantId], tokenRow[ThemeTokenRevisionsTable.name],
            )
    }

    private suspend fun validColorReference(entityId: UUID, tenantId: UUID, tokenName: String): Boolean {
        val project = currentTenantRows(tenantId = tenantId).singleOrNull()?.get(ThemeDesignSystemsTable.projectId)
        val snapshot = project?.let { ExposedTenantPaletteRepository().snapshot(ProjectId(it), tenantId) }
        return snapshot?.let { validPaletteReference(it, tenantId, entityId, tokenName) } ?: false
    }

    private fun validPaletteReference(
        snapshot: TenantPaletteSnapshot,
        tenantId: UUID,
        entityId: UUID,
        tokenName: String,
    ): Boolean {
        val reference = snapshot.values.singleOrNull { it.valueId == entityId.toString() }?.reference ?: return true
        val palette = ThemePaletteBuilder.build(
            tenantId.toString(),
            false,
            snapshot.state,
            snapshot.tokens,
            snapshot.values,
        )
        val groupId = ThemePaletteResolver.groupOf(palette, tokenName) ?: return false
        val previouslyStoredRamp = StablePaletteRamps.selectAll().where {
            (StablePaletteRamps.groupId eq UUID.fromString(groupId)) and
                (StablePaletteRamps.slotType eq reference.ramp.type) and
                (StablePaletteRamps.slotShade eq reference.ramp.shade)
        }.limit(1).any()
        // Нет предметной растяжки вообще — допустим исходный слот неизменяемого шаблона.
        // Предметная растяжка существовала и удалена — сначала требуется восстановить именно её.
        val rampAvailable = !previouslyStoredRamp || snapshot.state.ramps.any {
            it.groupId == groupId && it.slot == reference.ramp
        }
        return rampAvailable && ThemePaletteResolver.resolve(palette, tokenName, reference) != null
    }
}
