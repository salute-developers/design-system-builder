@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceVariation
import com.dsbuilder.ds.components.domain.AppearanceVariationAxis
import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed repository for appearances, variation axes, and declared axis values. */
@Suppress("TooManyFunctions")
class ExposedAppearanceRepository : AppearanceRepository {
    override suspend fun list(projectId: ProjectId, systemAdmin: Boolean): List<Appearance> =
        ComponentAppearancesTable.selectAll().where {
            ComponentOwnership.readableDesignSystem(
                ComponentAppearancesTable.designSystemId,
                projectId,
                systemAdmin,
            ) and ComponentOwnership.readableComponent(
                ComponentAppearancesTable.componentId,
                projectId,
                systemAdmin,
            )
        }.map(::appearance)

    override suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Appearance? =
        ComponentAppearancesTable.selectAll().where {
            (ComponentAppearancesTable.id eq id) and
                ComponentOwnership.readableDesignSystem(
                    ComponentAppearancesTable.designSystemId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.readableComponent(
                    ComponentAppearancesTable.componentId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull()?.let(::appearance)

    override suspend fun create(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceRepository.AppearanceCreate,
    ): Appearance? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId)) return null
        if (command.componentId !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)) return null
        return ComponentAppearancesTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[componentId] = command.componentId
            it[name] = command.name
        }.single().let(::appearance)
    }

    override suspend fun update(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AppearanceRepository.AppearanceUpdate,
    ): Appearance? {
        return ComponentAppearancesTable.updateReturning(where = {
            (ComponentAppearancesTable.id eq id) and
                ComponentOwnership.writableDesignSystem(
                    ComponentAppearancesTable.designSystemId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writableComponent(
                    ComponentAppearancesTable.componentId,
                    projectId,
                    systemAdmin,
                )
        }) {
            command.name?.let { value -> it[name] = value }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::appearance)
    }

    override suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return ComponentAppearancesTable.deleteWhere {
            (ComponentAppearancesTable.id eq id) and
                ComponentOwnership.writableDesignSystem(
                    ComponentAppearancesTable.designSystemId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writableComponent(
                    ComponentAppearancesTable.componentId,
                    projectId,
                    systemAdmin,
                )
        } > 0
    }

    override suspend fun axes(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
    ): List<AppearanceVariationAxis>? {
        return AppearanceVariationsTable.selectAll()
            .where {
                (AppearanceVariationsTable.appearanceId eq appearanceId) and
                    ComponentOwnership.readableAppearance(
                        AppearanceVariationsTable.appearanceId,
                        projectId,
                        systemAdmin,
                    )
            }
            .orderBy(AppearanceVariationsTable.position)
            .map(::appearanceVariation)
            .map { variation ->
                val values = AppearanceVariationValuesTable.selectAll()
                    .where {
                        (AppearanceVariationValuesTable.appearanceVariationId eq variation.id) and
                            ComponentOwnership.readableAppearanceVariation(
                                AppearanceVariationValuesTable.appearanceVariationId,
                                projectId,
                                systemAdmin,
                            )
                    }
                    .orderBy(AppearanceVariationValuesTable.position)
                    .map(::appearanceVariationValue)
                AppearanceVariationAxis(variation, values)
            }
    }

    override suspend fun listVariations(projectId: ProjectId, systemAdmin: Boolean): List<AppearanceVariation> =
        AppearanceVariationsTable.selectAll().where {
            ComponentOwnership.readableAppearance(
                AppearanceVariationsTable.appearanceId,
                projectId,
                systemAdmin,
            )
        }.map(::appearanceVariation)

    override suspend fun findVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): AppearanceVariation? = AppearanceVariationsTable.selectAll().where {
        (AppearanceVariationsTable.id eq id) and
            ComponentOwnership.readableAppearance(
                AppearanceVariationsTable.appearanceId,
                projectId,
                systemAdmin,
            )
    }.singleOrNull()?.let(::appearanceVariation)

    @Suppress("ReturnCount")
    override suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceRepository.VariationCreate,
    ): AppearanceVariation? {
        val appearance = find(projectId, systemAdmin, command.appearanceId) ?: return null
        if (!canWriteAppearance(projectId, systemAdmin, appearance)) return null
        if (!ComponentOwnership.canWriteVariation(projectId, systemAdmin, command.variationId)) return null
        if (
            command.defaultStyleId != null &&
            !canWriteStyle(projectId, systemAdmin, command.defaultStyleId)
        ) {
            return null
        }
        return AppearanceVariationsTable.insertReturning {
            it[appearanceId] = command.appearanceId
            it[variationId] = command.variationId
            it[position] = command.position
            it[defaultStyleId] = command.defaultStyleId
            it[isColorScheme] = command.isColorScheme
            it[declaredType] = command.declaredType
        }.single().let(::appearanceVariation)
    }

    @Suppress("ReturnCount")
    override suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AppearanceRepository.VariationUpdate,
    ): AppearanceVariation? {
        if (
            command.defaultStyleId != null &&
            !canWriteStyle(projectId, systemAdmin, command.defaultStyleId)
        ) {
            return null
        }
        return AppearanceVariationsTable.updateReturning(where = {
            (AppearanceVariationsTable.id eq id) and
                ComponentOwnership.writableAppearance(
                    AppearanceVariationsTable.appearanceId,
                    projectId,
                    systemAdmin,
                )
        }) {
            command.position?.let { value -> it[position] = value }
            if (command.defaultStyleIdPresent) it[defaultStyleId] = command.defaultStyleId
            command.isColorScheme?.let { value -> it[isColorScheme] = value }
            if (command.declaredTypePresent) it[declaredType] = command.declaredType
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::appearanceVariation)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return AppearanceVariationsTable.deleteWhere {
            (AppearanceVariationsTable.id eq id) and
                ComponentOwnership.writableAppearance(
                    AppearanceVariationsTable.appearanceId,
                    projectId,
                    systemAdmin,
                )
        } > 0
    }

    override suspend fun listValues(projectId: ProjectId, systemAdmin: Boolean): List<AppearanceVariationValue> =
        AppearanceVariationValuesTable.selectAll().where {
            ComponentOwnership.readableAppearanceVariation(
                AppearanceVariationValuesTable.appearanceVariationId,
                projectId,
                systemAdmin,
            )
        }.map(::appearanceVariationValue)

    override suspend fun findValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): AppearanceVariationValue? = AppearanceVariationValuesTable.selectAll().where {
        (AppearanceVariationValuesTable.id eq id) and
            ComponentOwnership.readableAppearanceVariation(
                AppearanceVariationValuesTable.appearanceVariationId,
                projectId,
                systemAdmin,
            )
    }.singleOrNull()?.let(::appearanceVariationValue)

    @Suppress("ReturnCount")
    override suspend fun createValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceRepository.ValueCreate,
    ): AppearanceVariationValue? {
        val variation = findVariation(projectId, systemAdmin, command.appearanceVariationId) ?: return null
        val appearance = find(projectId, systemAdmin, variation.appearanceId) ?: return null
        if (!canWriteAppearance(projectId, systemAdmin, appearance)) return null
        if (!canWriteStyle(projectId, systemAdmin, command.styleId)) return null
        return AppearanceVariationValuesTable.insertReturning {
            it[appearanceVariationId] = command.appearanceVariationId
            it[styleId] = command.styleId
            it[position] = command.position
            it[authoredId] = command.authoredId
        }.single().let(::appearanceVariationValue)
    }

    @Suppress("ReturnCount")
    override suspend fun updateValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AppearanceRepository.ValueUpdate,
    ): AppearanceVariationValue? {
        return AppearanceVariationValuesTable.updateReturning(
            where = {
                (AppearanceVariationValuesTable.id eq id) and
                    ComponentOwnership.writableAppearanceVariation(
                        AppearanceVariationValuesTable.appearanceVariationId,
                        projectId,
                        systemAdmin,
                    )
            },
        ) {
            command.position?.let { value -> it[position] = value }
            if (command.authoredIdPresent) it[authoredId] = command.authoredId
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::appearanceVariationValue)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteValue(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return AppearanceVariationValuesTable.deleteWhere {
            (AppearanceVariationValuesTable.id eq id) and
                ComponentOwnership.writableAppearanceVariation(
                    AppearanceVariationValuesTable.appearanceVariationId,
                    projectId,
                    systemAdmin,
                )
        } > 0
    }
}

private fun appearanceRow(id: UUID) = ComponentAppearancesTable.selectAll()
    .where { ComponentAppearancesTable.id eq id }.singleOrNull()
private fun appearanceVariationRow(id: UUID) = AppearanceVariationsTable.selectAll()
    .where { AppearanceVariationsTable.id eq id }.singleOrNull()
private fun appearanceVariationValueRow(id: UUID) = AppearanceVariationValuesTable.selectAll()
    .where { AppearanceVariationValuesTable.id eq id }.singleOrNull()

private fun appearance(row: ResultRow) = Appearance(
    row[ComponentAppearancesTable.id],
    row[ComponentAppearancesTable.designSystemId],
    row[ComponentAppearancesTable.componentId],
    row[ComponentAppearancesTable.name],
    row[ComponentAppearancesTable.createdAt],
    row[ComponentAppearancesTable.updatedAt],
)

private fun appearanceVariation(row: ResultRow) = AppearanceVariation(
    row[AppearanceVariationsTable.id], row[AppearanceVariationsTable.appearanceId],
    row[AppearanceVariationsTable.variationId], row[AppearanceVariationsTable.position],
    row[AppearanceVariationsTable.defaultStyleId], row[AppearanceVariationsTable.isColorScheme],
    row[AppearanceVariationsTable.declaredType], row[AppearanceVariationsTable.createdAt],
    row[AppearanceVariationsTable.updatedAt],
)

private fun appearanceVariationValue(row: ResultRow) = AppearanceVariationValue(
    row[AppearanceVariationValuesTable.id],
    row[AppearanceVariationValuesTable.appearanceVariationId],
    row[AppearanceVariationValuesTable.styleId],
    row[AppearanceVariationValuesTable.position],
    row[AppearanceVariationValuesTable.authoredId],
    row[AppearanceVariationValuesTable.createdAt],
    row[AppearanceVariationValuesTable.updatedAt],
)

private fun canReadAppearance(projectId: ProjectId, systemAdmin: Boolean, value: Appearance): Boolean =
    ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, value.designSystemId) &&
        value.componentId in ComponentOwnership.readableComponentIds(projectId, systemAdmin)

private fun canWriteAppearance(projectId: ProjectId, systemAdmin: Boolean, value: Appearance): Boolean =
    ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, value.designSystemId) &&
        value.componentId in ComponentOwnership.writableComponentIds(projectId, systemAdmin)

private fun canReadAppearanceVariation(
    projectId: ProjectId,
    systemAdmin: Boolean,
    value: AppearanceVariation,
): Boolean = appearanceRow(value.appearanceId)?.let(::appearance)
    ?.let { canReadAppearance(projectId, systemAdmin, it) } == true

private fun canReadAppearanceVariationValue(
    projectId: ProjectId,
    systemAdmin: Boolean,
    value: AppearanceVariationValue,
): Boolean = appearanceVariationRow(value.appearanceVariationId)?.let(::appearanceVariation)
    ?.let { canReadAppearanceVariation(projectId, systemAdmin, it) } == true

private fun canWriteStyle(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean =
    styleRow(id)?.let(::styleModel)?.let {
        ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, it.designSystemId) &&
            ComponentOwnership.canWriteVariation(projectId, systemAdmin, it.variationId)
    } == true
