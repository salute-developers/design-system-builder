package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemThemePreview
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant

/** Exposed implementation preserving global reads and project-owned mutations. */
class ExposedDesignSystemRepository : DesignSystemRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<DesignSystem> = DesignSystemsTable
        .selectAll()
        .where { (DesignSystemsTable.projectId eq projectId.value) or DesignSystemsTable.projectId.isNull() }
        .map(::toDomainWithThemeSummary)

    override suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem? = DesignSystemsTable
        .selectAll()
        .where {
            (DesignSystemsTable.id eq id.value) and
                ((DesignSystemsTable.projectId eq projectId.value) or DesignSystemsTable.projectId.isNull())
        }
        .limit(1)
        .singleOrNull()
        ?.let(::toDomainWithThemeSummary)

    override suspend fun createOwned(projectId: ProjectId, command: CreateDesignSystem): DesignSystem =
        DesignSystemsTable.insertReturning {
            it[name] = command.name
            it[projectName] = command.projectName
            it[DesignSystemsTable.projectId] = projectId.value
            it[description] = command.description
        }.single().let(::toDomain)

    override suspend fun updateOwned(
        projectId: ProjectId,
        id: DesignSystemId,
        command: UpdateDesignSystem,
    ): DesignSystem? = DesignSystemsTable.updateReturning(
        where = { (DesignSystemsTable.id eq id.value) and (DesignSystemsTable.projectId eq projectId.value) },
    ) {
        command.name?.let { value -> it[name] = value }
        if (command.descriptionPresent) it[description] = command.description
        it[DesignSystemsTable.updatedAt] = Instant.now()
    }.singleOrNull()?.let(::toDomain)

    override suspend fun deleteOwned(projectId: ProjectId, id: DesignSystemId): Boolean =
        DesignSystemsTable.deleteWhere {
            (DesignSystemsTable.id eq id.value) and (DesignSystemsTable.projectId eq projectId.value)
        } > 0

    private fun toDomain(row: ResultRow) = DesignSystem(
        id = DesignSystemId(row[DesignSystemsTable.id]),
        name = row[DesignSystemsTable.name],
        projectName = row[DesignSystemsTable.projectName],
        projectId = row[DesignSystemsTable.projectId]?.let(::ProjectId),
        description = row[DesignSystemsTable.description],
        createdAt = row[DesignSystemsTable.createdAt],
        updatedAt = row[DesignSystemsTable.updatedAt],
    )

    private fun toDomainWithThemeSummary(row: ResultRow): DesignSystem {
        val designSystem = toDomain(row)
        val themes = AggregateTenantsTable.selectAll()
            .where { AggregateTenantsTable.designSystemId eq designSystem.id.value }
            .orderBy(AggregateTenantsTable.createdAt)
            .map(::toThemePreview)
        return designSystem.copy(
            isTechnical = designSystem.projectId == null,
            tenantCount = themes.size,
            themePreviews = themes.take(4),
        )
    }

    private fun toThemePreview(row: ResultRow): DesignSystemThemePreview {
        val configuration = row[AggregateTenantsTable.colorConfig].jsonObject
        val profile = configuration["profile"]?.jsonPrimitive?.content
        val palette = configuration["customPalette"]?.jsonObject
        val fallback = previewFor(profile)
        return DesignSystemThemePreview(
            tenantId = row[AggregateTenantsTable.id],
            name = row[AggregateTenantsTable.name] ?: "",
            accentLight = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[0],
            onAccentLight = palette?.get("onPrimary")?.jsonPrimitive?.content ?: fallback[1],
            surfaceLight = palette?.get("background")?.jsonPrimitive?.content ?: fallback[2],
            accentDark = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[3],
            surfaceDark = fallback[4],
        )
    }

    private fun previewFor(profile: String?): List<String> = when (profile) {
        "sber" -> listOf("#108E26", "#FFFFFF", "#FFFFFF", "#1A9E32", "#101010")
        "malachite" -> listOf("#107F8C", "#FFFFFF", "#F7F9F8", "#19B9A5", "#111614")
        "b2b" -> listOf("#1B1D22", "#FFFFFF", "#F6F8FC", "#F8FAFC", "#111827")
        else -> listOf("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827")
    }
}
