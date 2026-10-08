package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.TenantPaletteLock
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.ThemeTokenType
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
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.notInList
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
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
            TenantPaletteGroupsTable.insertIgnore {
                it[id] = UUID.randomUUID()
                it[TenantPaletteGroupsTable.tenantId] = tenantId
                it[kind] = SYSTEM
                it[systemKey] = group.wireValue
                it[label] = group.label
                it[TenantPaletteGroupsTable.position] = position
                it[createdAt] = Instant.now()
                it[updatedAt] = Instant.now()
            }
        }
    }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TenantPaletteLock {
        val tenant = TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where { (TenantsTable.id eq tenantId) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
            // Только строка темы: операции над другими темами дизайн-системы и вставки, ссылающиеся на неё, не ждут.
            .forUpdate(ForUpdateOption.PostgreSQL.ForUpdate(null, TenantsTable))
            .limit(1)
            .singleOrNull() ?: return TenantPaletteLock.NotFound
        val current = tenant[TenantsTable.editRevision]
        return if (current == editRevision) TenantPaletteLock.Locked else TenantPaletteLock.RevisionConflict(current)
    }

    override suspend fun snapshot(projectId: ProjectId, tenantId: UUID): TenantPaletteSnapshot? {
        val tenant = TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where {
                (TenantsTable.id eq tenantId) and
                    (
                        (ThemeDesignSystemsTable.projectId eq projectId.value) or
                            ThemeDesignSystemsTable.projectId.isNull()
                        )
            }
            // FOR SHARE OF tenants: операции палитры и `PUT token-values` берут тему FOR UPDATE, поэтому все чтения
            // снимка видят одно зафиксированное состояние. Строка дизайн-системы не блокируется: иначе чтение ждало бы
            // операции над другими темами этой дизайн-системы.
            .forUpdate(ForUpdateOption.PostgreSQL.ForShare(null, TenantsTable))
            .limit(1)
            .singleOrNull() ?: return null
        val tokens = colorTokens(tenant[TenantsTable.designSystemId])
        val state = TenantPaletteState(
            editRevision = tenant[TenantsTable.editRevision],
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
        return TenantPaletteSnapshot(state, tokens, values, owned)
    }

    override suspend fun save(tenantId: UUID, state: TenantPaletteState) {
        val groupIds = state.groups.map { UUID.fromString(it.id) }
        TenantPaletteGroupsTable.deleteWhere {
            (TenantPaletteGroupsTable.tenantId eq tenantId) and (TenantPaletteGroupsTable.id notInList groupIds)
        }
        val existing = TenantPaletteGroupsTable.selectAll()
            .where { TenantPaletteGroupsTable.tenantId eq tenantId }
            .map { it[TenantPaletteGroupsTable.id] }
            .toSet()
        state.groups.forEachIndexed { position, group ->
            if (UUID.fromString(group.id) in existing) {
                updateGroup(group, position)
            } else {
                insertGroup(tenantId, group, position)
            }
        }
        TenantPaletteRampsTable.deleteWhere { TenantPaletteRampsTable.groupId inList groupIds }
        state.ramps.forEach(::insertRamp)
        TenantPaletteTokenGroupsTable.deleteWhere { TenantPaletteTokenGroupsTable.tenantId eq tenantId }
        TenantPaletteTokenGroupsTable.batchInsert(state.tokenGroups.entries) { (tokenId, groupId) ->
            this[TenantPaletteTokenGroupsTable.tenantId] = tenantId
            this[TenantPaletteTokenGroupsTable.tokenId] = UUID.fromString(tokenId)
            this[TenantPaletteTokenGroupsTable.groupId] = UUID.fromString(groupId)
        }
        TenantsTable.update({ TenantsTable.id eq tenantId }) {
            it[editRevision] = state.editRevision
            it[updatedAt] = Instant.now()
        }
    }

    override suspend fun rewriteTokenReferences(
        tenantId: UUID,
        rewrite: TokenReferenceRewrite,
        resolveHex: (Int) -> String?,
    ): Int {
        val tokenIds = rewrite.tokenIds.map(UUID::fromString)
        val paletteRows = paletteRows()
        val rows = ThemeTokenValuesTable.selectAll()
            .where { (ThemeTokenValuesTable.tenantId eq tenantId) and (ThemeTokenValuesTable.tokenId inList tokenIds) }
            .toList()
        return rows.count { row ->
            val reference = reference(row, paletteRows) ?: return@count false
            val next = rewrite.rewrite(reference, resolveHex) ?: return@count false
            ThemeTokenValuesTable.update({ ThemeTokenValuesTable.id eq row[ThemeTokenValuesTable.id] }) {
                // Та же форма, что пишет `PUT /tenants/{id}/token-values` из клиента:
                // строка в массиве, без `palette_id`.
                it[paletteId] = null
                it[value] = JsonArray(listOf(JsonPrimitive(next)))
                it[updatedAt] = Instant.now()
            }
            true
        }
    }

    private fun colorTokens(designSystemId: UUID): List<PaletteTokenRef> = ThemeTokensTable.selectAll()
        .where {
            (ThemeTokensTable.designSystemId eq designSystemId) and (ThemeTokensTable.type eq ThemeTokenType.COLOR)
        }
        .map { row ->
            val id = row[ThemeTokensTable.id].toString()
            PaletteTokenRef(id, row[ThemeTokensTable.name], row[ThemeTokensTable.displayName])
        }

    private fun colorValues(tenantId: UUID, tokenIds: List<UUID>): List<PaletteTokenValue> {
        val paletteRows = paletteRows()
        return ThemeTokenValuesTable.selectAll()
            .where { (ThemeTokenValuesTable.tenantId eq tenantId) and (ThemeTokenValuesTable.tokenId inList tokenIds) }
            .mapNotNull { row ->
                val platform = row[ThemeTokenValuesTable.platform] ?: return@mapNotNull null
                PaletteTokenValue(
                    tokenId = row[ThemeTokenValuesTable.tokenId].toString(),
                    mode = row[ThemeTokenValuesTable.mode]?.wireValue,
                    platform = platform.wireValue,
                    reference = reference(row, paletteRows),
                    valueId = row[ThemeTokenValuesTable.id].toString(),
                )
            }
    }

    private fun template(tenantId: UUID): Map<PaletteRampRef, Map<Int, String>> = TenantPaletteTemplateTable.selectAll()
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

    private fun insertGroup(tenantId: UUID, group: StoredPaletteGroup, position: Int) {
        TenantPaletteGroupsTable.insert {
            it[id] = UUID.fromString(group.id)
            it[TenantPaletteGroupsTable.tenantId] = tenantId
            it[kind] = group.kind
            it[systemKey] = group.systemKey?.wireValue
            it[label] = group.label
            it[TenantPaletteGroupsTable.position] = position
            it[createdAt] = Instant.now()
            it[updatedAt] = Instant.now()
        }
    }

    private fun updateGroup(group: StoredPaletteGroup, position: Int) {
        TenantPaletteGroupsTable.update({ TenantPaletteGroupsTable.id eq UUID.fromString(group.id) }) {
            it[label] = group.label
            it[TenantPaletteGroupsTable.position] = position
            it[updatedAt] = Instant.now()
        }
    }

    private fun insertRamp(ramp: StoredPaletteRamp) {
        val rampId = UUID.randomUUID()
        TenantPaletteRampsTable.insert {
            it[id] = rampId
            it[groupId] = UUID.fromString(ramp.groupId)
            it[slotType] = ramp.slot.type
            it[slotShade] = ramp.slot.shade
            it[sourceType] = ramp.source.type
            it[sourceShade] = ramp.source.shade
            it[added] = ramp.added
            it[origin] = ramp.origin
            it[anchorStep] = ramp.anchor?.step
            it[anchorValue] = ramp.anchor?.value
            it[createdAt] = Instant.now()
            it[updatedAt] = Instant.now()
        }
        TenantPaletteStepsTable.batchInsert(ramp.steps.entries) { (step, value) ->
            this[TenantPaletteStepsTable.rampId] = rampId
            this[TenantPaletteStepsTable.step] = step
            this[TenantPaletteStepsTable.value] = value
        }
    }

    private fun paletteRows(): Map<UUID, Pair<PaletteRampRef, Int>> = ThemePaletteTable.selectAll().associate { row ->
        val ramp = PaletteRampRef(row[ThemePaletteTable.type], row[ThemePaletteTable.shade])
        row[ThemePaletteTable.id] to (ramp to row[ThemePaletteTable.saturation])
    }

    /** Ссылка значения: `palette_id` с прозрачностью `null`/`["0.56"]` или строка `[type.shade.step][opacity]`. */
    private fun reference(row: ResultRow, paletteRows: Map<UUID, Pair<PaletteRampRef, Int>>): PaletteReference? {
        val value = row[ThemeTokenValuesTable.value]
        val text = value.singleText()
        val entry = row[ThemeTokenValuesTable.paletteId]?.let(paletteRows::get)
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
