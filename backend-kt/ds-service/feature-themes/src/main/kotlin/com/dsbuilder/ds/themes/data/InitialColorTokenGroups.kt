package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.themes.application.tokengroups.NewTokenGroup
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Первичная раскладка соответствует V6; выполняется только внутри изменяющей операции. */
internal suspend fun initializeColorTokenGroups(owner: UUID, repository: ExposedTokenGroupRepository) {
    lockDraftSubject(owner, "token-group-initialization", owner)
    // Даже удалённые группы означают, что инициализация уже выполнялась.
    if (StableTokenGroups.selectAll().where { StableTokenGroups.designSystemId eq owner }.any()) return
    val families = currentThemeTokenRows(owner).filter { it[ThemeTokenRevisionsTable.groupId] == null }
        .mapNotNull { row ->
            row[ThemeTokenRevisionsTable.type]?.let { type ->
                ColorTokenFamily.of(type, row[ThemeTokenRevisionsTable.name])?.let { it to row }
            }
        }
        .byFamilyName()
        .mapNotNull { (family, rows) ->
            initialSection(family)?.let { section ->
                InitialFamily(family, section, initialCategory(family, section), rows)
            }
        }
    families.groupBy { it.section }.toSortedMap().entries.forEachIndexed { sectionPosition, (section, items) ->
        val first = items.first().family
        val parent = repository.insert(
            NewTokenGroup(owner, TokenGroupKind.COLOR, null, first.group, SECTION_LABELS[section], sectionPosition),
        )
        items.groupBy { it.category }.entries.sortedWith(
            compareBy(
                { entry -> entry.value.minOf { item -> item.rows.minOf { it[ThemeTokensTable.createdAt] } } },
                { entry -> entry.value.minOf { it.family.name } },
            ),
        ).forEachIndexed { categoryPosition, (category, members) ->
            val child = repository.insert(
                NewTokenGroup(owner, TokenGroupKind.COLOR, parent.id, null, category, categoryPosition),
            )
            members.sortedWith(
                compareBy(
                    { item -> item.rows.minOf { it[ThemeTokensTable.createdAt] } },
                    { it.family.name },
                ),
            )
                .forEachIndexed { position, item ->
                    item.rows.sortedBy { it[ThemeTokensTable.id] }.forEach { row ->
                        reviseThemeToken(row[ThemeTokensTable.id], setOf("/group_id", "/position")) {
                            it.copy(groupId = child.id, position = position)
                        }
                    }
                }
        }
    }
}

private data class InitialFamily(
    val family: ColorTokenFamily,
    val section: Int,
    val category: String,
    val rows: List<org.jetbrains.exposed.v1.core.ResultRow>,
)

/**
 * Определения, сгруппированные по семейству по правилу имени (группа и имя) без учёта типа: тип производный, и члены
 * одного семейства могут временно иметь разные типы. Семейство группы — семейство её первого определения.
 */
internal fun <T> List<Pair<ColorTokenFamily, T>>.byFamilyName(): List<Pair<ColorTokenFamily, List<T>>> =
    groupBy { (family, _) -> family.group to family.name }
        .values
        .map { entries -> entries.first().first to entries.map { it.second } }

internal fun initialSection(family: ColorTokenFamily): Int? =
    if (family.group == "surface" && family.name == "read-only") {
        6
    } else {
        listOf("text", "surface", "outline", "background", "overlay", "data").indexOf(family.group).takeIf { it >= 0 }
    }

internal fun initialCategory(family: ColorTokenFamily, section: Int): String {
    if (section >= 3) return "Default"
    val category = when {
        Regex("accent|promo").containsMatchIn(family.name) -> "Accent"
        Regex("positive|negative|warning|info").containsMatchIn(family.name) -> "Status"
        else -> "General"
    }
    val suffix = when {
        section !in 1..2 -> ""
        family.name.startsWith("transparent-") || family.name == "clear" -> " / Transparent"
        else -> " / Solid"
    }
    return category + suffix
}

internal val SECTION_LABELS = listOf("Text & Icons", "Surfaces", "Outlines", "BG", "Overlays", "Data", "Technical")
