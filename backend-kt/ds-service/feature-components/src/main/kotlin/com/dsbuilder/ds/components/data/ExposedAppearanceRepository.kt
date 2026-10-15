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
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
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

    override suspend fun nameExists(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
        normalizedName: String?,
        excludingId: UUID?,
    ): Boolean = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.designSystemId eq designSystemId) and
            (ComponentAppearancesTable.componentId eq componentId) and
            ComponentOwnership.readableDesignSystem(
                ComponentAppearancesTable.designSystemId,
                projectId,
                systemAdmin,
            )
    }.any { row ->
        row[ComponentAppearancesTable.id] != excludingId &&
            row[ComponentAppearancesTable.name]?.trim()?.lowercase() == normalizedName
    }

    override suspend fun create(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceRepository.AppearanceCreate,
    ): Appearance? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId)) return null
        if (command.componentId !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)) return null
        val id = StableAppearancesTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[componentId] = command.componentId
        }.single()[StableAppearancesTable.id]
        AppearanceRevisionsTable.replaceRevision(AppearanceRevisionsTable.entityId, id, command.designSystemId) {
            it[name] = command.name
            it[rootVariationId] = null
            it[colorSchemeVariationId] = null
        }
        return requireNotNull(appearanceRow(id)).let(::appearance)
    }

    @Suppress("ReturnCount")
    override suspend fun update(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AppearanceRepository.AppearanceUpdate,
    ): Appearance? {
        if (!lockComponentSubject(
                StableAppearancesTable,
                StableAppearancesTable.id,
                StableAppearancesTable.designSystemId,
                "appearance",
                id,
            )
        ) {
            return null
        }
        val current = ComponentAppearancesTable.selectAll().where {
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
        }.singleOrNull() ?: return null
        if (command.name == null) return appearance(current)
        AppearanceRevisionsTable.replaceRevision(
            AppearanceRevisionsTable.entityId,
            id,
            current[ComponentAppearancesTable.designSystemId],
            changedPaths = setOf("/name"),
        ) {
            it[name] = command.name ?: current[ComponentAppearancesTable.name]
            it[rootVariationId] = current[ComponentAppearancesTable.rootVariationId]
            it[colorSchemeVariationId] = current[ComponentAppearancesTable.colorSchemeVariationId]
        }
        return appearanceRow(id)?.let(::appearance)
    }

    override suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableAppearancesTable,
                StableAppearancesTable.id,
                StableAppearancesTable.designSystemId,
                "appearance",
                id,
            )
        ) {
            return false
        }
        val current = ComponentAppearancesTable.selectAll().where {
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
        }.singleOrNull() ?: return false
        AppearanceRevisionsTable.replaceRevision(
            AppearanceRevisionsTable.entityId,
            id,
            current[ComponentAppearancesTable.designSystemId],
            deleted = true,
        ) {
            it[name] = current[ComponentAppearancesTable.name]
            it[rootVariationId] = current[ComponentAppearancesTable.rootVariationId]
            it[colorSchemeVariationId] = current[ComponentAppearancesTable.colorSchemeVariationId]
        }
        return true
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
            .let(::appearanceVariations)
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
        }.let(::appearanceVariations)

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
        val id = StableAppearanceVariationsTable.insertReturning {
            it[appearanceId] = command.appearanceId
            it[variationId] = command.variationId
            it[designSystemId] = appearance.designSystemId
        }.single()[StableAppearanceVariationsTable.id]
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            id,
            appearance.designSystemId,
        ) {
            it[position] = command.position
            it[defaultStyleId] = command.defaultStyleId
            it[declaredType] = command.declaredType
        }
        AppearanceAxisRoleStore.apply(
            command.appearanceId,
            command.variationId,
            root = command.isRoot.takeIf { it },
            colorScheme = command.isColorScheme.takeIf { it },
        )
        AppearanceAxisRoleStore.ensureRoot(command.appearanceId)
        return appearanceVariation(requireNotNull(appearanceVariationRow(id)))
    }

    @Suppress("LongMethod", "ReturnCount")
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
        if (!lockComponentSubject(
                StableAppearanceVariationsTable,
                StableAppearanceVariationsTable.id,
                StableAppearanceVariationsTable.designSystemId,
                "appearance-variation",
                id,
            )
        ) {
            return null
        }
        val current = AppearanceVariationsTable.selectAll().where {
            (AppearanceVariationsTable.id eq id) and
                ComponentOwnership.writableAppearance(
                    AppearanceVariationsTable.appearanceId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return null
        val appearance = requireNotNull(appearanceRow(current[AppearanceVariationsTable.appearanceId]))
        val localPaths = buildSet {
            if (command.position != null) add("/position")
            if (command.defaultStyleIdPresent) add("/default_style_id")
            if (command.declaredTypePresent) add("/declared_type")
        }
        if (localPaths.isNotEmpty()) {
            AppearanceVariationRevisionsTable.replaceRevision(
                AppearanceVariationRevisionsTable.entityId,
                id,
                appearance[ComponentAppearancesTable.designSystemId],
                changedPaths = localPaths,
            ) {
                it[position] = command.position ?: current[AppearanceVariationsTable.position]
                it[defaultStyleId] = if (command.defaultStyleIdPresent) {
                    command.defaultStyleId
                } else {
                    current[AppearanceVariationsTable.defaultStyleId]
                }
                it[declaredType] = if (command.declaredTypePresent) {
                    command.declaredType
                } else {
                    current[AppearanceVariationsTable.declaredType]
                }
            }
        }
        if (command.isRoot != null || command.isColorScheme != null) {
            AppearanceAxisRoleStore.apply(
                current[AppearanceVariationsTable.appearanceId],
                current[AppearanceVariationsTable.variationId],
                root = command.isRoot,
                colorScheme = command.isColorScheme,
            )
        }
        return appearanceVariation(requireNotNull(appearanceVariationRow(id)))
    }

    @Suppress("ReturnCount")
    override suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableAppearanceVariationsTable,
                StableAppearanceVariationsTable.id,
                StableAppearanceVariationsTable.designSystemId,
                "appearance-variation",
                id,
            )
        ) {
            return false
        }
        val row = appearanceVariationRow(id)
        val appearanceId = row?.get(AppearanceVariationsTable.appearanceId)
        val variationId = row?.get(AppearanceVariationsTable.variationId)
        if (appearanceId != null && variationId != null) {
            val roles = AppearanceAxisRoleStore.load(listOf(appearanceId))[appearanceId]
            if (roles?.root == variationId || roles?.colorScheme == variationId) {
                AppearanceAxisRoleStore.apply(
                    appearanceId,
                    variationId,
                    root = false.takeIf { roles.root == variationId },
                    colorScheme = false.takeIf { roles.colorScheme == variationId },
                )
            }
        }
        val current = AppearanceVariationsTable.selectAll().where {
            (AppearanceVariationsTable.id eq id) and
                ComponentOwnership.writableAppearance(
                    AppearanceVariationsTable.appearanceId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return false
        val appearance = requireNotNull(appearanceRow(current[AppearanceVariationsTable.appearanceId]))
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            id,
            appearance[ComponentAppearancesTable.designSystemId],
            deleted = true,
            changedPaths = setOf("/deleted"),
        ) {
            it[position] = current[AppearanceVariationsTable.position]
            it[defaultStyleId] = current[AppearanceVariationsTable.defaultStyleId]
            it[declaredType] = current[AppearanceVariationsTable.declaredType]
        }
        return true
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
        val id = StableAppearanceVariationValuesTable.insertReturning {
            it[appearanceVariationId] = command.appearanceVariationId
            it[designSystemId] = appearance.designSystemId
        }.single()[StableAppearanceVariationValuesTable.id]
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            id,
            appearance.designSystemId,
        ) {
            it[styleId] = command.styleId
            it[position] = command.position
            it[authoredId] = command.authoredId
        }
        return requireNotNull(appearanceVariationValueRow(id)).let(::appearanceVariationValue)
    }

    @Suppress("ReturnCount")
    override suspend fun updateValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AppearanceRepository.ValueUpdate,
    ): AppearanceVariationValue? {
        if (!lockComponentSubject(
                StableAppearanceVariationValuesTable,
                StableAppearanceVariationValuesTable.id,
                StableAppearanceVariationValuesTable.designSystemId,
                "appearance-variation-value",
                id,
            )
        ) {
            return null
        }
        val current = AppearanceVariationValuesTable.selectAll().where {
            (AppearanceVariationValuesTable.id eq id) and
                ComponentOwnership.writableAppearanceVariation(
                    AppearanceVariationValuesTable.appearanceVariationId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return null
        val variation = requireNotNull(
            appearanceVariationRow(current[AppearanceVariationValuesTable.appearanceVariationId]),
        )
        val appearance = requireNotNull(appearanceRow(variation[AppearanceVariationsTable.appearanceId]))
        val changedPaths = buildSet {
            if (command.position != null) add("/position")
            if (command.authoredIdPresent) add("/authored_id")
        }
        if (changedPaths.isEmpty()) return appearanceVariationValue(current)
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            id,
            appearance[ComponentAppearancesTable.designSystemId],
            changedPaths = changedPaths,
        ) {
            it[styleId] = current[AppearanceVariationValuesTable.styleId]
            it[position] = command.position ?: current[AppearanceVariationValuesTable.position]
            it[authoredId] = if (command.authoredIdPresent) {
                command.authoredId
            } else {
                current[AppearanceVariationValuesTable.authoredId]
            }
        }
        return appearanceVariationValueRow(id)?.let(::appearanceVariationValue)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteValue(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableAppearanceVariationValuesTable,
                StableAppearanceVariationValuesTable.id,
                StableAppearanceVariationValuesTable.designSystemId,
                "appearance-variation-value",
                id,
            )
        ) {
            return false
        }
        val current = AppearanceVariationValuesTable.selectAll().where {
            (AppearanceVariationValuesTable.id eq id) and
                ComponentOwnership.writableAppearanceVariation(
                    AppearanceVariationValuesTable.appearanceVariationId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return false
        val variation = requireNotNull(
            appearanceVariationRow(current[AppearanceVariationValuesTable.appearanceVariationId]),
        )
        val appearance = requireNotNull(appearanceRow(variation[AppearanceVariationsTable.appearanceId]))
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            id,
            appearance[ComponentAppearancesTable.designSystemId],
            deleted = true,
        ) {
            it[styleId] = current[AppearanceVariationValuesTable.styleId]
            it[position] = current[AppearanceVariationValuesTable.position]
            it[authoredId] = current[AppearanceVariationValuesTable.authoredId]
        }
        return true
    }
}

internal fun appearanceRow(id: UUID) = ComponentAppearancesTable.selectAll()
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

private fun appearanceVariations(rows: Iterable<ResultRow>): List<AppearanceVariation> {
    val list = rows.toList()
    val roles = AppearanceAxisRoleStore.load(list.map { it[AppearanceVariationsTable.appearanceId] }.toSet())
    return list.map { row ->
        val appearanceRoles = roles[row[AppearanceVariationsTable.appearanceId]]
        val variationId = row[AppearanceVariationsTable.variationId]
        AppearanceVariation(
            row[AppearanceVariationsTable.id], row[AppearanceVariationsTable.appearanceId],
            variationId, row[AppearanceVariationsTable.position],
            row[AppearanceVariationsTable.defaultStyleId], appearanceRoles?.colorScheme == variationId,
            appearanceRoles?.root == variationId,
            row[AppearanceVariationsTable.declaredType], row[AppearanceVariationsTable.createdAt],
            row[AppearanceVariationsTable.updatedAt],
        )
    }
}

private fun appearanceVariation(row: ResultRow) = appearanceVariations(listOf(row)).single()

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
