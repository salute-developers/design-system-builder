package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DesignSystemTokenPlacementInitializer
import com.dsbuilder.ds.core.application.InitialTokenDefinition
import com.dsbuilder.ds.core.application.InitialTokenPlacement
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Исходная раскладка создаётся в baseline вместе с токенами и не превращается в пользовательские изменения. */
class InitialTokenPlacementInitializer : DesignSystemTokenPlacementInitializer {
    override suspend fun initialize(
        designSystemId: UUID,
        definitions: List<InitialTokenDefinition>,
    ): Map<String, InitialTokenPlacement> {
        val baseline = ThemeVersionBoundariesTable.selectAll().where {
            (ThemeVersionBoundariesTable.designSystemId eq designSystemId) and
                (ThemeVersionBoundariesTable.status eq ThemeVersionBoundaryStatus.BASELINE)
        }.single()
        check(themeDraft(designSystemId) == null) { "Initial placements must precede the first draft" }
        val families = definitions.mapNotNull { definition ->
            val type = ThemeTokenType.fromWire(definition.type) ?: return@mapNotNull null
            val family = ColorTokenFamily.of(type, definition.name) ?: return@mapNotNull null
            val section = initialSection(family) ?: return@mapNotNull null
            Seed(definition.name, family, section, initialCategory(family, section))
        }.groupBy { it.section }
        return buildMap {
            families.toSortedMap().entries.forEachIndexed { sectionPosition, (section, seeds) ->
                val parent = insertGroup(
                    designSystemId,
                    baseline[ThemeVersionBoundariesTable.id],
                    null,
                    seeds.first().family.group,
                    SECTION_LABELS[section],
                    sectionPosition,
                )
                seeds.groupBy { it.category }.entries.sortedBy { (_, members) -> members.minOf { it.family.name } }
                    .forEachIndexed { categoryPosition, (category, members) ->
                        val child = insertGroup(
                            designSystemId,
                            baseline[ThemeVersionBoundariesTable.id],
                            parent,
                            null,
                            category,
                            categoryPosition,
                        )
                        members.groupBy { it.family }.entries.sortedWith(
                            compareBy({ it.key.name }, { it.key.type.wireValue }),
                        )
                            .forEachIndexed { position, (_, entries) ->
                                entries.forEach { put(it.name, InitialTokenPlacement(child, position)) }
                            }
                    }
            }
        }
    }

    private fun insertGroup(
        owner: UUID,
        baseline: UUID,
        parent: UUID?,
        code: String?,
        label: String,
        position: Int,
    ): UUID {
        val group = UUID.randomUUID()
        StableTokenGroups.insert {
            it[id] = group
            it[designSystemId] = owner
            it[kind] = TokenGroupKind.COLOR
            it[createdAt] = Instant.now()
        }
        TokenGroupRevisions.insert {
            it[id] = UUID.randomUUID()
            it[entityId] = group
            it[designSystemId] = owner
            it[designSystemVersionId] = baseline
            it[versionSequenceNumber] = 0
            it[parentId] = parent
            it[TokenGroupRevisions.code] = code
            it[TokenGroupRevisions.label] = label
            it[TokenGroupRevisions.position] = position
            it[deleted] = false
            it[updatedAt] = Instant.now()
        }
        return group
    }

    private data class Seed(val name: String, val family: ColorTokenFamily, val section: Int, val category: String)
}
