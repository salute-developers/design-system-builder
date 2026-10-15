package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.entityEditRevisions
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.CreateTenant
import com.dsbuilder.ds.themes.application.SaveTenantTokenValues
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValuesSaveOutcome
import com.dsbuilder.ds.themes.application.UpdateTenant
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemePreview
import com.dsbuilder.ds.themes.domain.ThemePreviewResolver
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed theme repository with ownership resolved through the parent design system. */
class ExposedTenantRepository : TenantRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<Tenant> {
        val rows = currentTenantRows(projectId = projectId)
        val revisions = tenantEditRevisions(rows)
        return rows.map { row -> toTenant(row, revisions[row[TenantsTable.id]] ?: 0) }
            .let(::withResolvedPreviews)
    }

    override suspend fun findAccessible(
        projectId: ProjectId,
        id: UUID,
    ): Tenant? = currentTenantRows(projectId = projectId, tenantId = id)
        .firstOrNull {
            it[TenantsTable.id] == id &&
                (
                    it[ThemeDesignSystemsTable.projectId] == projectId.value ||
                        it[ThemeDesignSystemsTable.projectId] == null
                    )
        }
        ?.let { row -> toTenant(row, tenantEditRevisions(listOf(row))[id] ?: 0) }
        ?.let { tenant -> withResolvedPreviews(listOf(tenant)).single() }

    override suspend fun nameExists(
        projectId: ProjectId,
        designSystemId: UUID,
        normalizedName: String,
        excludingId: UUID?,
    ): Boolean = currentTenantRows(projectId = projectId, designSystemId = designSystemId).any { row ->
        row[TenantsTable.designSystemId] == designSystemId &&
            row[ThemeDesignSystemsTable.projectId] == projectId.value &&
            row[TenantsTable.id] != excludingId &&
            row[TenantRevisionsTable.name]?.trim()?.lowercase() == normalizedName
    }

    override suspend fun createOwned(projectId: ProjectId, command: CreateTenant): Tenant? {
        if (!ownedDesignSystem(projectId, command.designSystemId)) return null
        val entity = TenantsTable.insertReturning {
            it[designSystemId] = command.designSystemId
        }.single()
        val draft = themeDraft(command.designSystemId) ?: error("Active draft is missing")
        SubjectMutationPaths.with(setOf("/name", "/description", "/color_config")) {
            TenantRevisionsTable.insert {
                it[tenantId] = entity[TenantsTable.id]
                it[designSystemId] = command.designSystemId
                it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
                it[name] = command.name
                it[description] = command.description
                it[colorConfig] = ColorConfigurationMapper.toJson(command.colorConfiguration)
                it[deleted] = false
            }
        }
        val created = currentTenantRows(
            designSystemId = command.designSystemId,
            tenantId = entity[TenantsTable.id],
        ).single()
        return toTenant(created, 0)
    }

    @Suppress("ReturnCount")
    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTenant): Tenant? {
        val current = currentTenantRows(projectId = projectId, tenantId = id).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value }
            ?: return null
        val designSystemId = current[TenantsTable.designSystemId]
        val changedPaths = buildSet {
            if (command.namePresent) add("/name")
            if (command.descriptionPresent) add("/description")
            if (command.colorConfigurationPresent) add("/color_config")
        }
        if (changedPaths.isEmpty()) {
            val tenant = toTenant(current, tenantEditRevisions(listOf(current))[id] ?: 0)
            return withResolvedPreviews(listOf(tenant)).single()
        }
        if (themeDraft(designSystemId) == null) return null
        if (!lockDraftSubject(designSystemId, "tenant", id)) return null
        writeTenantRevision(
            current,
            name = if (command.namePresent) command.name else current[TenantRevisionsTable.name],
            description = if (command.descriptionPresent) {
                command.description
            } else {
                current[TenantRevisionsTable.description]
            },
            colorConfig = if (command.colorConfigurationPresent) {
                ColorConfigurationMapper.toJson(requireNotNull(command.colorConfiguration))
            } else {
                current[TenantRevisionsTable.colorConfig]
            },
            deleted = false,
            paths = changedPaths,
        )
        val updated = currentTenantRows(designSystemId = designSystemId, tenantId = id).singleOrNull() ?: return null
        val tenant = toTenant(updated, tenantEditRevisions(listOf(updated))[id] ?: 0)
        return withResolvedPreviews(listOf(tenant)).single()
    }

    @Suppress("ReturnCount")
    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean {
        val current = currentTenantRows(projectId = projectId, tenantId = id).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value }
            ?: return false
        val designSystemId = current[TenantsTable.designSystemId]
        if (themeDraft(designSystemId) == null) return false
        TenantsTable.selectAll().where {
            (TenantsTable.id eq id) and (TenantsTable.designSystemId eq designSystemId)
        }.forUpdate().singleOrNull() ?: return false
        if (!lockDraftSubject(designSystemId, "tenant", id)) return false
        if (removeDraftOnlyTenant(current)) return true
        writeTenantRevision(
            current,
            current[TenantRevisionsTable.name],
            current[TenantRevisionsTable.description],
            current[TenantRevisionsTable.colorConfig],
            deleted = true,
            paths = setOf("/deleted"),
        )
        return true
    }

    /** Removes a tenant that has never crossed a published boundary together with its draft-only values. */
    @Suppress("ReturnCount")
    private fun removeDraftOnlyTenant(current: ResultRow): Boolean {
        val tenantId = current[TenantsTable.id]
        val designSystemId = current[TenantsTable.designSystemId]
        val draftId = themeDraft(designSystemId)?.get(ThemeVersionBoundariesTable.id) ?: return false
        val tenantVersions = TenantRevisionsTable.selectAll()
            .where { TenantRevisionsTable.tenantId eq tenantId }
            .map { it[TenantRevisionsTable.designSystemVersionId] }
        if (tenantVersions != listOf(draftId)) return false

        val valueIds = ThemeTokenValuesTable.selectAll()
            .where { ThemeTokenValuesTable.tenantId eq tenantId }
            .map { it[ThemeTokenValuesTable.id] }
        val hasHistoricalValue = valueIds.isNotEmpty() && ThemeTokenValueRevisionsTable.selectAll().where {
            (ThemeTokenValueRevisionsTable.tokenValueId inList valueIds) and
                (ThemeTokenValueRevisionsTable.designSystemVersionId neq draftId)
        }.limit(1).any()
        if (hasHistoricalValue) return false

        if (valueIds.isNotEmpty()) {
            ThemeTokenValueRevisionsTable.deleteWhere {
                ThemeTokenValueRevisionsTable.tokenValueId inList valueIds
            }
            ThemeTokenValuesTable.deleteWhere { ThemeTokenValuesTable.id inList valueIds }
        }
        TenantRevisionsTable.deleteWhere { TenantRevisionsTable.tenantId eq tenantId }
        return TenantsTable.deleteWhere { TenantsTable.id eq tenantId } == 1
    }

    override suspend fun tokenValues(projectId: ProjectId, id: UUID): List<TenantTokenValue>? {
        if (findAccessible(projectId, id) == null) return null
        val tenant = currentTenantRows(projectId = projectId, tenantId = id).singleOrNull() ?: return null
        val rows = currentThemeTokenValueRows(
            designSystemId = tenant[TenantsTable.designSystemId],
            tenantIds = setOf(id),
        )
        val revisions = rows.firstOrNull()?.let { row ->
            entityEditRevisions(
                row[ThemeVersionBoundariesTable.id],
                TOKEN_VALUE_ENTITY_TYPE,
                rows.mapTo(mutableSetOf()) { it[ThemeTokenValuesTable.id] },
            )
        }.orEmpty()
        return rows.map { row -> toTokenValue(row, revisions[row[ThemeTokenValuesTable.id]] ?: 0) }
    }

    @Suppress("ReturnCount")
    override suspend fun saveTokenValues(
        projectId: ProjectId,
        id: UUID,
        command: SaveTenantTokenValues,
    ): TenantTokenValuesSaveOutcome {
        val candidate = currentTenantRows(projectId = projectId, tenantId = id).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value }
            ?: return TenantTokenValuesSaveOutcome.NotFound
        val designSystemId = candidate[TenantsTable.designSystemId]
        if (themeDraft(designSystemId) == null) return TenantTokenValuesSaveOutcome.NotFound
        TenantsTable.selectAll().where {
            (TenantsTable.id eq id) and (TenantsTable.designSystemId eq designSystemId)
        }.forUpdate(ForUpdateOption.PostgreSQL.ForKeyShare).singleOrNull()
            ?: return TenantTokenValuesSaveOutcome.NotFound
        val tenant = currentTenantRows(projectId = projectId, tenantId = id).singleOrNull()
            ?.takeIf {
                it[ThemeDesignSystemsTable.projectId] == projectId.value &&
                    it[TenantsTable.designSystemId] == designSystemId
            }
            ?: return TenantTokenValuesSaveOutcome.NotFound
        val tokenIds = command.values.map { it.tokenId }.distinct()
        val validTokenCount = if (tokenIds.isEmpty()) {
            0
        } else {
            currentThemeTokenRows(designSystemId, tokenIds.toSet()).size.toLong()
        }
        if (validTokenCount != tokenIds.size.toLong()) return TenantTokenValuesSaveOutcome.ForeignToken
        command.values.sortedWith(
            compareBy(
                { it.tokenId.toString() },
                { it.platform.wireValue },
                { it.mode?.wireValue.orEmpty() },
            ),
        ).forEach { value ->
            val entity = ThemeTokenValuesTable.selectAll().where {
                (ThemeTokenValuesTable.tokenId eq value.tokenId) and
                    (ThemeTokenValuesTable.tenantId eq id) and
                    (ThemeTokenValuesTable.platform eq value.platform) and
                    (ThemeTokenValuesTable.mode eq value.mode)
            }.forUpdate().singleOrNull() ?: ThemeTokenValuesTable.insertReturning {
                it[ThemeTokenValuesTable.designSystemId] = tenant[TenantsTable.designSystemId]
                it[tokenId] = value.tokenId
                it[tenantId] = id
                it[platform] = value.platform
                it[mode] = value.mode
            }.single()
            writeTokenValueRevision(
                entityId = entity[ThemeTokenValuesTable.id],
                designSystemId = tenant[TenantsTable.designSystemId],
                paletteId = value.paletteId,
                value = value.value,
                deleted = false,
                paths = setOf("/palette_id", "/value"),
                baseRevision = value.baseRevision,
            )
        }
        val requestedKeys = command.values.mapTo(hashSetOf()) { value ->
            Triple(value.tokenId, value.platform, value.mode)
        }
        val savedRows = currentThemeTokenValueRows(
            designSystemId = designSystemId,
            tenantIds = setOf(id),
            tokenIds = tokenIds.toSet(),
        ).filter { row ->
            Triple(
                row[ThemeTokenValuesTable.tokenId],
                row[ThemeTokenValuesTable.platform],
                row[ThemeTokenValuesTable.mode],
            ) in requestedKeys
        }
        val savedRevisions = entityEditRevisions(
            tenant[ThemeVersionBoundariesTable.id],
            TOKEN_VALUE_ENTITY_TYPE,
            savedRows.mapTo(hashSetOf()) { it[ThemeTokenValuesTable.id] },
        )
        return TenantTokenValuesSaveOutcome.Saved(
            tenantEditRevisions(listOf(tenant))[id] ?: 0,
            savedRows.map { row -> toTokenValue(row, savedRevisions[row[ThemeTokenValuesTable.id]] ?: 0) },
        )
    }

    private fun ownedDesignSystem(projectId: ProjectId, id: UUID): Boolean = ThemeDesignSystemsTable
        .selectAll()
        .where { (ThemeDesignSystemsTable.id eq id) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()

    private fun toTenant(row: ResultRow, editRevision: Int) = Tenant(
        id = row[TenantsTable.id],
        designSystemId = row[TenantsTable.designSystemId],
        name = row[TenantRevisionsTable.name],
        description = row[TenantRevisionsTable.description],
        colorConfiguration = ColorConfigurationMapper.fromJson(row[TenantRevisionsTable.colorConfig]),
        editRevision = editRevision,
        preview = ThemePreviewResolver.resolve(
            ColorConfigurationMapper.fromJson(row[TenantRevisionsTable.colorConfig]),
        ),
        createdAt = row[TenantsTable.createdAt],
        updatedAt = row[TenantRevisionsTable.updatedAt],
    )

    private fun toTokenValue(row: ResultRow, editRevision: Long) = TenantTokenValue(
        id = row[ThemeTokenValuesTable.id],
        tokenId = row[ThemeTokenValuesTable.tokenId],
        tenantId = row[ThemeTokenValuesTable.tenantId],
        paletteId = row[ThemeTokenValueRevisionsTable.paletteId],
        platform = row[ThemeTokenValuesTable.platform]?.wireValue,
        mode = row[ThemeTokenValuesTable.mode]?.wireValue,
        valueJson = row[ThemeTokenValueRevisionsTable.value]?.toString(),
        editRevision = editRevision,
        createdAt = row[ThemeTokenValuesTable.createdAt],
        updatedAt = row[ThemeTokenValueRevisionsTable.updatedAt],
    )

    private fun tenantEditRevisions(rows: List<ResultRow>): Map<UUID, Int> {
        if (rows.isEmpty()) return emptyMap()
        val tenantIds = rows.mapTo(hashSetOf()) { it[TenantsTable.id] }
        val valuesByTenant = ThemeTokenValuesTable.selectAll()
            .where { ThemeTokenValuesTable.tenantId inList tenantIds }
            .groupBy({ it[ThemeTokenValuesTable.tenantId] }, { it[ThemeTokenValuesTable.id] })
        return rows.groupBy { it[ThemeVersionBoundariesTable.id] }.flatMap { (boundaryId, boundaryRows) ->
            val valueToTenant = boundaryRows.flatMap { row ->
                valuesByTenant[row[TenantsTable.id]].orEmpty().map { valueId -> valueId to row[TenantsTable.id] }
            }.toMap()
            val revisions = entityEditRevisions(boundaryId, TOKEN_VALUE_ENTITY_TYPE, valueToTenant.keys)
            boundaryRows.map { row ->
                val tenantId = row[TenantsTable.id]
                tenantId to valueToTenant.filterValues { it == tenantId }.keys
                    .maxOfOrNull { revisions[it] ?: 0L }?.toInt().orZero()
            }
        }.toMap()
    }

    private fun withResolvedPreviews(tenants: List<Tenant>): List<Tenant> {
        if (tenants.isEmpty()) return tenants
        val designSystemIds = tenants.mapTo(hashSetOf()) { it.designSystemId }
        val colorTokens = designSystemIds.flatMap { currentThemeTokenRows(it) }
            .filter { it[ThemeTokenRevisionsTable.type] == ThemeTokenType.COLOR }
            .associate { row -> row[ThemeTokensTable.id] to row[ThemeTokenRevisionsTable.name] }
        val palettes = ThemePaletteTable.selectAll()
            .associate { row -> row[ThemePaletteTable.id] to row[ThemePaletteTable.value] }
        val tenantIds = tenants.map(Tenant::id).toSet()
        val values = designSystemIds.flatMap { designSystemId ->
            currentThemeTokenValueRows(designSystemId = designSystemId, tenantIds = tenantIds)
        }
            .mapNotNull { row -> previewValue(row, colorTokens, palettes) }
        return tenants.map { tenant -> tenant.copy(preview = preview(tenant, values)) }
    }

    private fun preview(tenant: Tenant, values: List<PreviewValue>): ThemePreview {
        val fallback = ThemePreviewResolver.resolve(tenant.colorConfiguration)
        fun resolve(mode: ThemeTokenMode, names: Set<String>): String? = values.firstOrNull { value ->
            value.tenantId == tenant.id && value.mode == mode && value.tokenName.lowercase() in names
        }?.let { value -> color(value.paletteValue) ?: color(value.value) }
        return ThemePreview(
            accentLight = resolve(ThemeTokenMode.LIGHT, ACCENT_NAMES) ?: fallback.accentLight,
            onAccentLight = resolve(ThemeTokenMode.LIGHT, ON_ACCENT_NAMES) ?: fallback.onAccentLight,
            surfaceLight = resolve(ThemeTokenMode.LIGHT, SURFACE_NAMES) ?: fallback.surfaceLight,
            accentDark = resolve(ThemeTokenMode.DARK, ACCENT_NAMES) ?: fallback.accentDark,
            surfaceDark = resolve(ThemeTokenMode.DARK, SURFACE_NAMES) ?: fallback.surfaceDark,
        )
    }

    private fun previewValue(
        row: ResultRow,
        tokens: Map<UUID, String>,
        palettes: Map<UUID, String>,
    ): PreviewValue? = row[ThemeTokenValuesTable.tokenId]?.let { tokenId ->
        tokens[tokenId]?.let { tokenName ->
            PreviewValue(
                tenantId = row[ThemeTokenValuesTable.tenantId],
                tokenName = tokenName,
                mode = row[ThemeTokenValuesTable.mode],
                value = row[ThemeTokenValueRevisionsTable.value],
                paletteValue = row[ThemeTokenValueRevisionsTable.paletteId]?.let(palettes::get),
            )
        }
    }

    private fun writeTenantRevision(
        current: ResultRow,
        name: String?,
        description: String?,
        colorConfig: kotlinx.serialization.json.JsonElement,
        deleted: Boolean,
        paths: Set<String>,
    ) {
        val designSystemId = current[TenantsTable.designSystemId]
        val draft = themeDraft(designSystemId) ?: error("Active draft is missing")
        TenantRevisionsTable.deleteWhere {
            (TenantRevisionsTable.tenantId eq current[TenantsTable.id]) and
                (TenantRevisionsTable.designSystemVersionId eq draft[ThemeVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(paths) {
            TenantRevisionsTable.insert {
                it[tenantId] = current[TenantsTable.id]
                it[TenantRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
                it[TenantRevisionsTable.name] = name
                it[TenantRevisionsTable.description] = description
                it[TenantRevisionsTable.colorConfig] = colorConfig
                it[TenantRevisionsTable.deleted] = deleted
            }
        }
    }

    private fun writeTokenValueRevision(current: ResultRow, deleted: Boolean) = writeTokenValueRevision(
        entityId = current[ThemeTokenValuesTable.id],
        designSystemId = current[ThemeTokenValuesTable.designSystemId],
        paletteId = current[ThemeTokenValueRevisionsTable.paletteId],
        value = current[ThemeTokenValueRevisionsTable.value],
        deleted = deleted,
        paths = setOf("/deleted"),
        baseRevision = null,
    )

    private fun writeTokenValueRevision(
        entityId: UUID,
        designSystemId: UUID,
        paletteId: UUID?,
        value: kotlinx.serialization.json.JsonElement?,
        deleted: Boolean,
        paths: Set<String>,
        baseRevision: Long?,
    ) {
        val draft = themeDraft(designSystemId) ?: error("Active draft is missing")
        ThemeTokenValueRevisionsTable.deleteWhere {
            (ThemeTokenValueRevisionsTable.tokenValueId eq entityId) and
                (ThemeTokenValueRevisionsTable.designSystemVersionId eq draft[ThemeVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(paths, baseRevision) {
            ThemeTokenValueRevisionsTable.insert {
                it[tokenValueId] = entityId
                it[ThemeTokenValueRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
                it[ThemeTokenValueRevisionsTable.paletteId] = paletteId
                it[ThemeTokenValueRevisionsTable.value] = value
                it[ThemeTokenValueRevisionsTable.deleted] = deleted
            }
        }
    }

    private fun color(value: kotlinx.serialization.json.JsonElement?): String? = (value as? JsonArray)
        ?.firstOrNull()?.jsonPrimitive?.content
        ?.takeIf { candidate -> COLOR.matches(candidate) }
        ?.uppercase()

    private fun color(value: String?): String? = value
        ?.takeIf { candidate -> COLOR.matches(candidate) }
        ?.uppercase()

    private data class PreviewValue(
        val tenantId: UUID?,
        val tokenName: String,
        val mode: ThemeTokenMode?,
        val value: kotlinx.serialization.json.JsonElement?,
        val paletteValue: String?,
    )

    private companion object {
        val ACCENT_NAMES = setOf("surface.default.accent", "text.default.accent")
        val ON_ACCENT_NAMES = setOf("on-accent", "on_accent", "text.on-dark.primary")
        val SURFACE_NAMES = setOf(
            "surface.default.solid-card",
            "surface.default.primary",
            "background.default.primary",
        )
        val COLOR = Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")
        const val TOKEN_VALUE_ENTITY_TYPE = "token-value"
    }
}

private fun Int?.orZero(): Int = this ?: 0
