package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import com.dsbuilder.ds.themes.domain.palette.ShadowLayerColors
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Не позволяет отменой вернуть значение удалённого токена или ссылку на недоступную растяжку: цвет токена или цвет
 * слоя тени.
 */
class PaletteRevertDependencyValidator : DraftChangeDependencyValidator {
    override val supportsLiteralValueBatchRevert: Boolean = true
    override suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean =
        valid(designSystemId, entityType, entityId, hashMapOf())

    /** Пакет проверяется с одним снимком палитры на тему: значения одного токена обычно из одних тем. */
    override suspend fun firstInvalid(designSystemId: UUID, entities: List<Pair<String, UUID>>): Int? {
        val snapshots = hashMapOf<UUID, TenantPaletteSnapshot?>()
        return entities.indexOfFirst { (type, id) -> !valid(designSystemId, type, id, snapshots) }
            .takeIf { it >= 0 }
    }

    private suspend fun valid(
        designSystemId: UUID,
        entityType: String,
        entityId: UUID,
        snapshots: MutableMap<UUID, TenantPaletteSnapshot?>,
    ): Boolean {
        if (entityType != "token-value") return true
        val stable = ThemeTokenValuesTable.selectAll().where {
            (ThemeTokenValuesTable.id eq entityId) and (ThemeTokenValuesTable.designSystemId eq designSystemId)
        }.singleOrNull() ?: return true
        return validRestoredValue(designSystemId, entityId, stable, snapshots)
    }

    private suspend fun validRestoredValue(
        designSystemId: UUID,
        entityId: UUID,
        stable: ResultRow,
        snapshots: MutableMap<UUID, TenantPaletteSnapshot?>,
    ): Boolean {
        val tokenId = stable[ThemeTokenValuesTable.tokenId]
        val tokenRow = currentThemeTokenRows(designSystemId, setOf(tokenId)).singleOrNull() ?: return false
        val value = currentThemeTokenValueRows(
            designSystemId, setOf(stable[ThemeTokenValuesTable.tenantId]), setOf(tokenId),
        ).firstOrNull { it[ThemeTokenValuesTable.id] == entityId } ?: return true
        val type = tokenRow[ThemeTokenRevisionsTable.type]
        // Наличие определения проверено выше. Литерал не требует разрешения всей палитры темы.
        val storedValue = value[ThemeTokenValueRevisionsTable.value]
        val hasReferences = value[ThemeTokenValueRevisionsTable.paletteId] != null ||
            ValuePaletteReferences.find(storedValue).isNotEmpty() ||
            (type == ThemeTokenType.SHADOW && ShadowLayerColors.references(storedValue).isNotEmpty())
        return type !in REFERENCING_TYPES ||
            !hasReferences ||
            validReferences(
                entityId,
                value[ThemeTokenValuesTable.tenantId],
                tokenRow[ThemeTokenRevisionsTable.name],
                snapshots,
            )
    }

    private suspend fun validReferences(
        entityId: UUID,
        tenantId: UUID,
        tokenName: String,
        snapshots: MutableMap<UUID, TenantPaletteSnapshot?>,
    ): Boolean {
        val snapshot = if (tenantId in snapshots) {
            snapshots[tenantId]
        } else {
            snapshot(
                tenantId,
            ).also { snapshots[tenantId] = it }
        }
        return snapshot?.let { validPaletteReferences(it, tenantId, entityId, tokenName) } ?: false
    }

    private suspend fun snapshot(tenantId: UUID): TenantPaletteSnapshot? {
        val project = currentTenantRows(tenantId = tenantId).singleOrNull()?.get(ThemeDesignSystemsTable.projectId)
        return project?.let { ExposedTenantPaletteRepository().snapshot(ProjectId(it), tenantId) }
    }

    /** Ссылки восстановленного значения: на всё значение, в стопах градиента или в цветах слоёв тени. */
    private fun validPaletteReferences(
        snapshot: TenantPaletteSnapshot,
        tenantId: UUID,
        entityId: UUID,
        tokenName: String,
    ): Boolean {
        // Ссылка на всё значение, ссылки в стопах градиента и в цветах слоёв тени: каждая должна указывать
        // на доступную растяжку.
        val references = (snapshot.values + snapshot.layerValues)
            .filter { it.valueId == entityId.toString() }
            .mapNotNull { it.reference }
        if (references.isEmpty()) return true
        val palette = snapshot.palette(tenantId.toString(), false)
        val groupId = ThemePaletteResolver.groupOf(palette, tokenName) ?: return false
        return references.distinct().all { reference ->
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
            rampAvailable && ThemePaletteResolver.resolve(palette, tokenName, reference) != null
        }
    }

    private companion object {
        /** Типы токенов, значения которых ссылаются на ступени палитры: цвет, градиент и слои тени. */
        val REFERENCING_TYPES = ColorTokenFamily.TYPES + ThemeTokenType.SHADOW
    }
}
