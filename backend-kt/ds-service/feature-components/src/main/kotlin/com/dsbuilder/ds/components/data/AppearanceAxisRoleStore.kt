@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AxisRoleConflictException
import com.dsbuilder.ds.components.domain.RootCandidate
import com.dsbuilder.ds.components.domain.fallbackRoot
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Роли осей appearance: корневая ось и ось цветовой схемы.
 *
 * Роль хранится ссылкой с appearance на ось, объявленную у него же. Флаг `is_color_scheme` на связи
 * сохранён ради существующей схемы и всегда повторяет ссылку.
 */
internal object AppearanceAxisRoleStore {
    /** Роли одного appearance. */
    data class Roles(val root: UUID?, val colorScheme: UUID?)

    /** Читает роли указанных appearance. */
    fun load(appearanceIds: Collection<UUID>): Map<UUID, Roles> {
        if (appearanceIds.isEmpty()) return emptyMap()
        return ComponentAppearancesTable.selectAll().where { ComponentAppearancesTable.id inList appearanceIds }
            .associate {
                it[ComponentAppearancesTable.id] to Roles(
                    it[ComponentAppearancesTable.rootVariationId],
                    it[ComponentAppearancesTable.colorSchemeVariationId],
                )
            }
    }

    /**
     * Назначает или снимает роли оси [variationId] у appearance [appearanceId].
     *
     * Роль, назначенная одной оси, снимается с прежней. Ось с ролью корня не может получить роль цветовой
     * схемы и наоборот, иначе бросается [AxisRoleConflictException].
     */
    fun apply(appearanceId: UUID, variationId: UUID, root: Boolean?, colorScheme: Boolean?) {
        if (root == null && colorScheme == null) return
        val current = load(listOf(appearanceId)).getValue(appearanceId)
        val nextScheme = next(current.colorScheme, variationId, colorScheme)
        var nextRoot = next(current.root, variationId, root)
        val requested = root == true || colorScheme == true
        if (requested && nextRoot != null && nextRoot == nextScheme) throw AxisRoleConflictException()
        if (nextRoot == null && root == false && current.root == variationId) {
            nextRoot = fallbackRoot(candidates(appearanceId), nextScheme, excluded = variationId)
        }
        val changedPaths = buildSet {
            if (current.root != nextRoot) add("/root_variation_id")
            if (current.colorScheme != nextScheme) add("/color_scheme_variation_id")
        }
        if (changedPaths.isEmpty()) return
        store(appearanceId, nextRoot, nextScheme, changedPaths)
    }

    /** Значение роли после запроса: `true` назначает ось, `false` снимает роль только с неё, `null` не меняет. */
    private fun next(current: UUID?, variationId: UUID, requested: Boolean?): UUID? = when (requested) {
        true -> variationId
        false -> current.takeUnless { it == variationId }
        null -> current
    }

    /** Назначает корень по правилу фолбэка, если у appearance с осями он не задан. */
    fun ensureRoot(appearanceId: UUID) {
        val roles = load(listOf(appearanceId))[appearanceId] ?: return
        if (roles.root != null) return
        val root = fallbackRoot(candidates(appearanceId), roles.colorScheme) ?: return
        store(appearanceId, root, roles.colorScheme, setOf("/root_variation_id"))
    }

    /** Записывает роли. Вычисляемый флаг `is_color_scheme` в текущем представлении повторяет эту ссылку. */
    fun store(
        appearanceId: UUID,
        root: UUID?,
        colorScheme: UUID?,
        changedPaths: Set<String> = setOf("/root_variation_id", "/color_scheme_variation_id"),
    ) {
        check(
            lockComponentSubject(
                StableAppearancesTable,
                StableAppearancesTable.id,
                StableAppearancesTable.designSystemId,
                "appearance",
                appearanceId,
            ),
        ) { "Appearance is missing" }
        val current = ComponentAppearancesTable.selectAll()
            .where { ComponentAppearancesTable.id eq appearanceId }
            .single()
        AppearanceRevisionsTable.replaceRevision(
            AppearanceRevisionsTable.entityId,
            appearanceId,
            current[ComponentAppearancesTable.designSystemId],
            changedPaths = changedPaths,
        ) {
            it[name] = current[ComponentAppearancesTable.name]
            it[rootVariationId] = root
            it[colorSchemeVariationId] = colorScheme
            it[isDefault] = current[ComponentAppearancesTable.isDefault]
        }
    }

    private fun candidates(appearanceId: UUID): List<RootCandidate<UUID>> =
        AppearanceVariationsTable.join(
            VariationsTable,
            JoinType.INNER,
            AppearanceVariationsTable.variationId,
            VariationsTable.id,
        ).selectAll().where { AppearanceVariationsTable.appearanceId eq appearanceId }.map {
            RootCandidate(
                it[AppearanceVariationsTable.variationId],
                it[VariationsTable.name],
                it[AppearanceVariationsTable.position],
            )
        }
}
