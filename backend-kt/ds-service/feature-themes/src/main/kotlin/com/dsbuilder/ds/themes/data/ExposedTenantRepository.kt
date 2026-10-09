package com.dsbuilder.ds.themes.data

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
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed theme repository with ownership resolved through the parent design system. */
class ExposedTenantRepository : TenantRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<Tenant> = scopedQuery(projectId)
        .map(::toTenant)
        .let(::withResolvedPreviews)

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): Tenant? = TenantsTable
        .innerJoin(ThemeDesignSystemsTable)
        .selectAll()
        .where {
            (TenantsTable.id eq id) and
                ((ThemeDesignSystemsTable.projectId eq projectId.value) or ThemeDesignSystemsTable.projectId.isNull())
        }
        .limit(1)
        .singleOrNull()
        ?.let(::toTenant)
        ?.let { tenant -> withResolvedPreviews(listOf(tenant)).single() }

    override suspend fun createOwned(projectId: ProjectId, command: CreateTenant): Tenant? {
        if (!ownedDesignSystem(projectId, command.designSystemId)) return null
        return TenantsTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[name] = command.name
            it[description] = command.description
            it[colorConfig] = ColorConfigurationMapper.toJson(command.colorConfiguration)
        }.single().let(::toTenant)
    }

    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTenant): Tenant? {
        if (!ownedTenant(projectId, id)) return null
        return TenantsTable.updateReturning(where = { TenantsTable.id eq id }) {
            if (command.namePresent) it[name] = command.name
            if (command.descriptionPresent) it[description] = command.description
            if (command.colorConfigurationPresent) {
                it[colorConfig] = ColorConfigurationMapper.toJson(requireNotNull(command.colorConfiguration))
            }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::toTenant)
    }

    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean =
        ownedTenant(projectId, id) && TenantsTable.deleteWhere { TenantsTable.id eq id } > 0

    override suspend fun tokenValues(projectId: ProjectId, id: UUID): List<TenantTokenValue>? {
        if (findAccessible(projectId, id) == null) return null
        return ThemeTokenValuesTable.selectAll()
            .where { ThemeTokenValuesTable.tenantId eq id }
            .map(::toTokenValue)
    }

    @Suppress("ReturnCount")
    override suspend fun saveTokenValues(
        projectId: ProjectId,
        id: UUID,
        command: SaveTenantTokenValues,
    ): TenantTokenValuesSaveOutcome {
        val tenant = TenantsTable
            .innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where { (TenantsTable.id eq id) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
            .forUpdate()
            .limit(1)
            .singleOrNull()
            ?: return TenantTokenValuesSaveOutcome.NotFound
        val currentRevision = tenant[TenantsTable.editRevision]
        if (currentRevision != command.expectedEditRevision) {
            return TenantTokenValuesSaveOutcome.RevisionConflict(currentRevision)
        }
        val tokenIds = command.values.map { it.tokenId }.distinct()
        val validTokenCount = if (tokenIds.isEmpty()) {
            0
        } else {
            ThemeTokensTable.selectAll()
                .where {
                    (ThemeTokensTable.designSystemId eq tenant[TenantsTable.designSystemId]) and
                        (ThemeTokensTable.id inList tokenIds)
                }
                .count()
        }
        if (validTokenCount != tokenIds.size.toLong()) return TenantTokenValuesSaveOutcome.ForeignToken
        ThemeTokenValuesTable.deleteWhere {
            (tenantId eq id) and platform.isNotNull()
        }
        command.values.forEach { value ->
            ThemeTokenValuesTable.insert {
                it[tokenId] = value.tokenId
                it[tenantId] = id
                it[paletteId] = value.paletteId
                it[platform] = value.platform
                it[mode] = value.mode
                it[ThemeTokenValuesTable.value] = value.value
            }
        }
        val nextRevision = currentRevision + 1
        TenantsTable.updateReturning(where = { TenantsTable.id eq id }) {
            it[editRevision] = nextRevision
            it[updatedAt] = Instant.now()
        }.single()
        return TenantTokenValuesSaveOutcome.Saved(nextRevision)
    }

    private fun scopedQuery(projectId: ProjectId) = TenantsTable
        .innerJoin(ThemeDesignSystemsTable)
        .selectAll()
        .where {
            (ThemeDesignSystemsTable.projectId eq projectId.value) or ThemeDesignSystemsTable.projectId.isNull()
        }

    private fun ownedTenant(projectId: ProjectId, id: UUID): Boolean = TenantsTable
        .innerJoin(ThemeDesignSystemsTable)
        .selectAll()
        .where { (TenantsTable.id eq id) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()

    private fun ownedDesignSystem(projectId: ProjectId, id: UUID): Boolean = ThemeDesignSystemsTable
        .selectAll()
        .where { (ThemeDesignSystemsTable.id eq id) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()

    private fun toTenant(row: ResultRow) = Tenant(
        id = row[TenantsTable.id],
        designSystemId = row[TenantsTable.designSystemId],
        name = row[TenantsTable.name],
        description = row[TenantsTable.description],
        colorConfiguration = ColorConfigurationMapper.fromJson(row[TenantsTable.colorConfig]),
        editRevision = row[TenantsTable.editRevision],
        preview = ThemePreviewResolver.resolve(ColorConfigurationMapper.fromJson(row[TenantsTable.colorConfig])),
        createdAt = row[TenantsTable.createdAt],
        updatedAt = row[TenantsTable.updatedAt],
    )

    private fun toTokenValue(row: ResultRow) = TenantTokenValue(
        id = row[ThemeTokenValuesTable.id],
        tokenId = row[ThemeTokenValuesTable.tokenId],
        tenantId = row[ThemeTokenValuesTable.tenantId],
        paletteId = row[ThemeTokenValuesTable.paletteId],
        platform = row[ThemeTokenValuesTable.platform]?.wireValue,
        mode = row[ThemeTokenValuesTable.mode]?.wireValue,
        valueJson = row[ThemeTokenValuesTable.value]?.toString(),
        createdAt = row[ThemeTokenValuesTable.createdAt],
        updatedAt = row[ThemeTokenValuesTable.updatedAt],
    )

    private fun withResolvedPreviews(tenants: List<Tenant>): List<Tenant> {
        if (tenants.isEmpty()) return tenants
        val colorTokens = ThemeTokensTable.selectAll()
            .where { ThemeTokensTable.type eq ThemeTokenType.COLOR }
            .associate { row -> row[ThemeTokensTable.id] to row[ThemeTokensTable.name] }
        val palettes = ThemePaletteTable.selectAll()
            .associate { row -> row[ThemePaletteTable.id] to row[ThemePaletteTable.value] }
        val values = ThemeTokenValuesTable.selectAll()
            .where { ThemeTokenValuesTable.tenantId inList tenants.map(Tenant::id) }
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
                value = row[ThemeTokenValuesTable.value],
                paletteValue = row[ThemeTokenValuesTable.paletteId]?.let(palettes::get),
            )
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
    }
}
