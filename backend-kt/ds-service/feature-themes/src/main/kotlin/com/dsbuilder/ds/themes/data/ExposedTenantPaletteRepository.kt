package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.TenantPaletteLock
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupKind
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenValue
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteRamp
import com.dsbuilder.ds.themes.domain.palette.SystemPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.palette.TokenReferenceRewrite
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed-хранилище палитры темы: таблицы `tenant_palette_*` и значения токенов темы. */
class ExposedTenantPaletteRepository : TenantPaletteRepository {
    override suspend fun initialize(tenantId: UUID) {
        // Идемпотентно: копия шаблона берётся только целиком и один раз, системные группы — только недостающие.
        // `ignore` (ON CONFLICT DO NOTHING) защищает от одновременной инициализации двумя запросами.
        val hasTemplate = !TenantPaletteTemplateTable.selectAll()
            .where { TenantPaletteTemplateTable.tenantId eq tenantId }
            .limit(1)
            .empty()
        // Порядок ключа копии: одновременные инициализации вставляют строки в одном порядке и не блокируют друг друга.
        val templateRows = if (hasTemplate) {
            emptyList()
        } else {
            ThemePaletteTable.selectAll()
                .orderBy(ThemePaletteTable.type to SortOrder.ASC, ThemePaletteTable.shade to SortOrder.ASC)
                .orderBy(ThemePaletteTable.saturation)
                .toList()
        }
        TenantPaletteTemplateTable.batchInsert(templateRows, ignore = true) { row ->
            this[TenantPaletteTemplateTable.tenantId] = tenantId
            this[TenantPaletteTemplateTable.type] = row[ThemePaletteTable.type]
            this[TenantPaletteTemplateTable.shade] = row[ThemePaletteTable.shade]
            this[TenantPaletteTemplateTable.step] = row[ThemePaletteTable.saturation]
            this[TenantPaletteTemplateTable.value] = row[ThemePaletteTable.value]
        }
        val existing = groups(tenantId).mapNotNull { it.systemKey }.toSet()
        SystemPaletteGroup.entries.forEachIndexed { position, group ->
            if (group in existing) return@forEachIndexed
            val owner = requireNotNull(
                currentTenantRows(tenantId = tenantId).singleOrNull(),
            )[TenantsTable.designSystemId]
            insertPaletteGroup(
                owner,
                tenantId,
                StoredPaletteGroup(UUID.randomUUID().toString(), SYSTEM, group, group.label),
                position,
            )
        }
    }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TenantPaletteLock {
        val tenant = currentTenantRows(projectId, tenantId = tenantId).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value } ?: return TenantPaletteLock.NotFound
        lockDesignSystemMutation(tenant[TenantsTable.designSystemId])
        return TenantPaletteLock.Locked
    }

    override suspend fun snapshot(
        projectId: ProjectId,
        tenantId: UUID,
        includeSubjectRevisions: Boolean,
    ): TenantPaletteSnapshot? {
        val tenant = currentTenantRows(projectId, tenantId = tenantId).singleOrNull() ?: return null
        val tokens = colorTokens(tenant[TenantsTable.designSystemId])
        val state = TenantPaletteState(
            editRevision = 0,
            template = template(tenantId),
            groups = groups(tenantId),
            ramps = ramps(tenantId),
            tokenGroups = TenantPaletteTokenGroupsTable.selectAll()
                .where { TenantPaletteTokenGroupsTable.tenantId eq tenantId }
                .associate { row ->
                    val tokenId = row[TenantPaletteTokenGroupsTable.tokenId].toString()
                    tokenId to row[TenantPaletteTokenGroupsTable.groupId].toString()
                },
        )
        val values = colorValues(tenantId, tokens.map { UUID.fromString(it.id) })
        val owned = tenant[ThemeDesignSystemsTable.projectId] == projectId.value
        return TenantPaletteSnapshot(
            state,
            tokens,
            values,
            owned,
            if (includeSubjectRevisions) paletteSubjectRevisions(tenantId) else emptyMap(),
        )
    }

    override suspend fun save(tenantId: UUID, before: TenantPaletteState, state: TenantPaletteState) {
        val owner = requireNotNull(currentTenantRows(tenantId = tenantId).singleOrNull())[TenantsTable.designSystemId]
        PaletteStateWriter(owner, tenantId).save(before, state)
    }

    override suspend fun rewriteTokenReferences(
        tenantId: UUID,
        rewrite: TokenReferenceRewrite,
        resolveHex: (Int) -> String?,
    ): Int {
        val tokenIds = rewrite.tokenIds.map(UUID::fromString)
        val paletteRows = paletteRows()
        if (tokenIds.isEmpty()) return 0
        val rows = currentThemeTokenValueRows(tenantIds = setOf(tenantId), tokenIds = tokenIds.toSet())
        val updates = rows.mapNotNull { row ->
            val whole = reference(row, paletteRows)
            val next = if (whole != null) {
                rewrite.rewrite(whole, resolveHex)?.let { JsonArray(listOf(JsonPrimitive(it))) }
            } else {
                // Ссылки в стопах градиента и в слоях iOS и Android: меняются только сами ссылки.
                row[ThemeTokenValueRevisionsTable.value]?.let { value ->
                    ValuePaletteReferences.rewrite(value) { rewrite.rewrite(it, resolveHex) }.takeIf { it != value }
                }
            } ?: return@mapNotNull null
            row[ThemeTokenValuesTable.id] to
                ThemeValuePayload(null, next, row[ThemeTokenValueRevisionsTable.overridden])
        }.toMap()
        if (updates.isNotEmpty()) {
            writeThemeValueRevisions(rows.first()[ThemeTokenValuesTable.designSystemId], updates)
        }
        return updates.size
    }

    private fun colorTokens(designSystemId: UUID): List<PaletteTokenRef> = currentThemeTokenRows(designSystemId)
        .filter { it[ThemeTokenRevisionsTable.type] in ColorTokenFamily.TYPES }
        .map { row ->
            val id = row[ThemeTokensTable.id].toString()
            PaletteTokenRef(id, row[ThemeTokenRevisionsTable.name], row[ThemeTokenRevisionsTable.displayName])
        }

    private fun colorValues(tenantId: UUID, tokenIds: List<UUID>): List<PaletteTokenValue> {
        val paletteRows = paletteRows()
        if (tokenIds.isEmpty()) return emptyList()
        return currentThemeTokenValueRows(tenantIds = setOf(tenantId), tokenIds = tokenIds.toSet())
            .flatMap { row ->
                val platform = row[ThemeTokenValuesTable.platform] ?: return@flatMap emptyList()
                // У градиента ссылок может быть несколько: по записи на каждую различную ссылку значения.
                val references = reference(row, paletteRows)?.let(::listOf)
                    ?: ValuePaletteReferences.find(row[ThemeTokenValueRevisionsTable.value]).distinct()
                references.ifEmpty { listOf(null) }.map { reference ->
                    PaletteTokenValue(
                        tokenId = row[ThemeTokenValuesTable.tokenId].toString(),
                        mode = row[ThemeTokenValuesTable.mode]?.wireValue,
                        platform = platform.wireValue,
                        reference = reference,
                        valueId = row[ThemeTokenValuesTable.id].toString(),
                    )
                }
            }
    }

    override suspend fun template(tenantId: UUID): Map<PaletteRampRef, Map<Int, String>> =
        TenantPaletteTemplateTable.selectAll()
            .where { TenantPaletteTemplateTable.tenantId eq tenantId }
            .groupBy(
                { PaletteRampRef(it[TenantPaletteTemplateTable.type], it[TenantPaletteTemplateTable.shade]) },
                { it[TenantPaletteTemplateTable.step] to it[TenantPaletteTemplateTable.value] },
            )
            .mapValues { (_, steps) -> steps.toMap() }

    private fun groups(tenantId: UUID): List<StoredPaletteGroup> = TenantPaletteGroupsTable.selectAll()
        .where { TenantPaletteGroupsTable.tenantId eq tenantId }
        .orderBy(TenantPaletteGroupsTable.position)
        .map { row ->
            StoredPaletteGroup(
                id = row[TenantPaletteGroupsTable.id].toString(),
                kind = row[TenantPaletteGroupsTable.kind],
                systemKey = SystemPaletteGroup.fromWire(row[TenantPaletteGroupsTable.systemKey]),
                label = row[TenantPaletteGroupsTable.label],
            )
        }

    private fun ramps(tenantId: UUID): List<StoredPaletteRamp> {
        val rows = TenantPaletteRampsTable
            .join(
                TenantPaletteGroupsTable,
                JoinType.INNER,
                TenantPaletteRampsTable.groupId,
                TenantPaletteGroupsTable.id,
            )
            .selectAll()
            .where { TenantPaletteGroupsTable.tenantId eq tenantId }
            .orderBy(TenantPaletteRampsTable.createdAt)
            .toList()
        val steps = TenantPaletteStepsTable.selectAll()
            .where { TenantPaletteStepsTable.rampId inList rows.map { it[TenantPaletteRampsTable.id] } }
            .groupBy(
                { it[TenantPaletteStepsTable.rampId] },
                { it[TenantPaletteStepsTable.step] to it[TenantPaletteStepsTable.value] },
            )
        return rows.map { row -> toRamp(row, steps[row[TenantPaletteRampsTable.id]].orEmpty().toMap()) }
    }

    private fun toRamp(row: ResultRow, steps: Map<Int, String>) = StoredPaletteRamp(
        groupId = row[TenantPaletteRampsTable.groupId].toString(),
        slot = PaletteRampRef(row[TenantPaletteRampsTable.slotType], row[TenantPaletteRampsTable.slotShade]),
        source = PaletteRampRef(row[TenantPaletteRampsTable.sourceType], row[TenantPaletteRampsTable.sourceShade]),
        added = row[TenantPaletteRampsTable.added],
        origin = row[TenantPaletteRampsTable.origin],
        anchor = row[TenantPaletteRampsTable.anchorStep]?.let { step ->
            row[TenantPaletteRampsTable.anchorValue]?.let { PaletteAnchor(step, it) }
        },
        steps = steps,
    )

    private fun paletteRows(): Map<UUID, Pair<PaletteRampRef, Int>> = ThemePaletteTable.selectAll().associate { row ->
        val ramp = PaletteRampRef(row[ThemePaletteTable.type], row[ThemePaletteTable.shade])
        row[ThemePaletteTable.id] to (ramp to row[ThemePaletteTable.saturation])
    }

    /** Ссылка значения: `palette_id` с прозрачностью `null`/`["0.56"]` или строка `[type.shade.step][opacity]`. */
    private fun reference(row: ResultRow, paletteRows: Map<UUID, Pair<PaletteRampRef, Int>>): PaletteReference? {
        val value = row[ThemeTokenValueRevisionsTable.value]
        val text = value.singleText()
        val entry = row[ThemeTokenValueRevisionsTable.paletteId]?.let(paletteRows::get)
        val opacity = text?.toDoubleOrNull()
        return when {
            entry != null && (value.isEmptyValue() || opacity != null) ->
                PaletteReference(entry.first, entry.second, opacity)
            else -> PaletteReference.parse(text)
        }
    }

    private fun JsonElement?.singleText(): String? = when (this) {
        is JsonArray -> (singleOrNull() as? JsonPrimitive)?.takeIf { it.isString }?.content
        is JsonPrimitive -> takeIf { it.isString }?.content
        else -> null
    }

    private fun JsonElement?.isEmptyValue(): Boolean =
        this == null || this is JsonNull || (this is JsonArray && isEmpty())

    private companion object {
        val SYSTEM = PaletteGroupKind.SYSTEM
    }
}
