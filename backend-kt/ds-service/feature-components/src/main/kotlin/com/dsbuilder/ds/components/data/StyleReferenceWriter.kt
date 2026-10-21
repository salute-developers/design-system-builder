package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Запись и проверка ссылок значения свойства на стиль вложенного компонента. */
internal object StyleReferenceWriter {
    /** Предельная длина цепочки ссылок между оформлениями; совпадает с пределом превью клиента. */
    const val MAX_DEPTH = 5

    /** Владелец ссылки: значение свойства определённого вида. */
    sealed interface Source {
        /** Значение базы оформления. */
        data class Invariant(val id: UUID) : Source

        /** Значение одного стиля. */
        data class Variation(val id: UUID) : Source

        /** Значение сочетания стилей. */
        data class Combination(val id: UUID) : Source
    }

    /** Результат проверки ссылки. */
    class Resolved(val target: ResultRow, val styleIds: List<UUID>, val text: String)

    /** Проверяет ссылку и собирает её текст до записи значения-владельца. */
    fun resolve(
        projectId: ProjectId,
        systemAdmin: Boolean,
        sourceAppearance: ResultRow,
        input: AppearanceEditorRepository.StyleReferenceInput,
        replacing: Source?,
    ): Resolved {
        val designSystemId = sourceAppearance[ComponentAppearancesTable.designSystemId]
        val target = EditorSupport.readableAppearance(projectId, systemAdmin, input.targetAppearanceId)
            ?.takeIf { it[ComponentAppearancesTable.designSystemId] == designSystemId }
            ?: throw EditorRuleViolationException(
                "reference_target_not_found",
                "The target configuration is not available",
            )
        val styleIds = input.styleIds.distinct()
        val styleAxes = EditorSupport.styleAxes(target[ComponentAppearancesTable.id])
        val axesOfStyles = styleIds.map { styleAxes[it] }
        if (axesOfStyles.any { it == null } || axesOfStyles.distinct().size != axesOfStyles.size) {
            throw EditorRuleViolationException(
                "reference_invalid_styles",
                "Styles must belong to axes of the target configuration, at most one per axis",
            )
        }
        val sourceId = sourceAppearance[ComponentAppearancesTable.id]
        checkChain(designSystemId, sourceId, target[ComponentAppearancesTable.id], replacing)
        return Resolved(target, styleIds, text(designSystemId, target, styleIds))
    }

    /** Записывает ссылку владельца [source]; `input == null` удаляет существующую ссылку. */
    fun write(designSystemId: UUID, source: Source, resolved: Resolved?, sourceComponentId: UUID) {
        val existing = existing(source)
        if (resolved == null) {
            if (existing != null) removeWithStyles(designSystemId, existing)
            return
        }
        val referenceId = existing?.get(ComponentStyleReferencesTable.id) ?: run {
            val id = StableComponentStyleReferencesTable.insertReturning {
                it[StableComponentStyleReferencesTable.designSystemId] = designSystemId
            }.single()[StableComponentStyleReferencesTable.id]
            id
        }
        val targetId = resolved.target[ComponentAppearancesTable.id]
        val unchanged = existing != null && existing[ComponentStyleReferencesTable.targetAppearanceId] == targetId &&
            existing[ComponentStyleReferencesTable.reference] == resolved.text
        if (!unchanged) {
            if (existing != null) {
                check(lockDraftSubjects(designSystemId, "component-style-reference", listOf(referenceId)))
            }
            ComponentStyleReferenceRevisionsTable.replaceRevision(
                ComponentStyleReferenceRevisionsTable.entityId,
                referenceId,
                designSystemId,
            ) {
                it[invariantPropertyValueId] = (source as? Source.Invariant)?.id
                it[variationPropertyValueId] = (source as? Source.Variation)?.id
                it[styleCombinationId] = (source as? Source.Combination)?.id
                it[targetAppearanceId] = targetId
                it[reference] = resolved.text
            }
        }
        replaceStyles(designSystemId, referenceId, resolved.styleIds)
        ensureDependency(sourceComponentId, resolved.target[ComponentAppearancesTable.componentId])
    }

    /** Текущая ссылка владельца либо `null`. */
    fun existing(source: Source): ResultRow? = ComponentStyleReferencesTable.selectAll().where {
        when (source) {
            is Source.Invariant -> ComponentStyleReferencesTable.invariantPropertyValueId eq source.id
            is Source.Variation -> ComponentStyleReferencesTable.variationPropertyValueId eq source.id
            is Source.Combination -> ComponentStyleReferencesTable.styleCombinationId eq source.id
        }
    }.singleOrNull()

    /** Удаляет ссылку вместе со связями со стилями. */
    fun removeWithStyles(designSystemId: UUID, reference: ResultRow) {
        val styles = ComponentStyleReferenceStylesTable.selectAll()
            .where { ComponentStyleReferenceStylesTable.referenceId eq reference[ComponentStyleReferencesTable.id] }
            .toList()
        lock(designSystemId, "component-style-reference", listOf(reference[ComponentStyleReferencesTable.id]))
        lock(
            designSystemId,
            "component-style-reference-style",
            styles.map { it[ComponentStyleReferenceStylesTable.id] },
        )
        styles.forEach { EditorWrites.removeReferenceStyle(designSystemId, it) }
        EditorWrites.removeReference(designSystemId, reference)
    }

    private fun replaceStyles(designSystemId: UUID, referenceId: UUID, styleIds: List<UUID>) {
        val current = ComponentStyleReferenceStylesTable.selectAll()
            .where { ComponentStyleReferenceStylesTable.referenceId eq referenceId }.toList()
        val wanted = styleIds.toSet()
        val kept = current.filter { it[ComponentStyleReferenceStylesTable.styleId] in wanted }
        val removed = current - kept.toSet()
        lock(
            designSystemId,
            "component-style-reference-style",
            removed.map { it[ComponentStyleReferenceStylesTable.id] },
        )
        removed.forEach { EditorWrites.removeReferenceStyle(designSystemId, it) }
        val have = kept.map { it[ComponentStyleReferenceStylesTable.styleId] }.toSet()
        styleIds.filter { it !in have }.forEach { styleId ->
            val id = StableComponentStyleReferenceStylesTable.insertReturning {
                it[StableComponentStyleReferenceStylesTable.referenceId] = referenceId
                it[StableComponentStyleReferenceStylesTable.designSystemId] = designSystemId
            }.single()[StableComponentStyleReferenceStylesTable.id]
            ComponentStyleReferenceStyleRevisionsTable.replaceRevision(
                ComponentStyleReferenceStyleRevisionsTable.entityId,
                id,
                designSystemId,
            ) { it[ComponentStyleReferenceStyleRevisionsTable.styleId] = styleId }
        }
    }

    /** Текст ссылки: имя оформления и действующие имена стилей в порядке осей цели. */
    fun text(designSystemId: UUID, target: ResultRow, styleIds: List<UUID>): String {
        val axes = AppearanceEditorModelReader.axes(target[ComponentAppearancesTable.id], designSystemId, null)
        val names = axes.sortedBy { it.position }.flatMap { axis ->
            axis.values.filter { it.styleId in styleIds }.map { it.name }
        }
        return (listOf(target[ComponentAppearancesTable.name] ?: "default") + names).joinToString(".")
    }

    /** Пересобирает текст ссылок на оформление [targetAppearanceId] после переименования оформления или его осей. */
    fun rebuildTexts(designSystemId: UUID, targetAppearanceId: UUID) {
        val target = appearanceRow(targetAppearanceId) ?: return
        ComponentStyleReferencesTable.selectAll().where {
            (ComponentStyleReferencesTable.designSystemId eq designSystemId) and
                (ComponentStyleReferencesTable.targetAppearanceId eq targetAppearanceId)
        }.toList().forEach { row ->
            val styleIds = ComponentStyleReferenceStylesTable.selectAll()
                .where { ComponentStyleReferenceStylesTable.referenceId eq row[ComponentStyleReferencesTable.id] }
                .map { it[ComponentStyleReferenceStylesTable.styleId] }
            val text = text(designSystemId, target, styleIds)
            if (text != row[ComponentStyleReferencesTable.reference]) {
                lock(designSystemId, "component-style-reference", listOf(row[ComponentStyleReferencesTable.id]))
                ComponentStyleReferenceRevisionsTable.replaceRevision(
                    ComponentStyleReferenceRevisionsTable.entityId,
                    row[ComponentStyleReferencesTable.id],
                    designSystemId,
                    changedPaths = setOf("/reference"),
                ) {
                    it[invariantPropertyValueId] = row[ComponentStyleReferencesTable.invariantPropertyValueId]
                    it[variationPropertyValueId] = row[ComponentStyleReferencesTable.variationPropertyValueId]
                    it[styleCombinationId] = row[ComponentStyleReferencesTable.styleCombinationId]
                    it[ComponentStyleReferenceRevisionsTable.targetAppearanceId] =
                        row[ComponentStyleReferencesTable.targetAppearanceId]
                    it[reference] = text
                }
            }
        }
    }

    private fun lock(designSystemId: UUID, type: String, ids: List<UUID>) {
        check(lockDraftSubjects(designSystemId, type, ids)) { "Subject $type is missing" }
    }

    @Suppress("ThrowsCount")
    private fun checkChain(designSystemId: UUID, sourceAppearance: UUID, targetAppearance: UUID, replacing: Source?) {
        if (sourceAppearance == targetAppearance) {
            throw EditorRuleViolationException("reference_cycle", "A configuration cannot reference itself")
        }
        val edges = edges(designSystemId, replacing)
        if (reachable(edges, targetAppearance, sourceAppearance)) {
            throw EditorRuleViolationException("reference_cycle", "The reference closes a cycle of configurations")
        }
        val reversed = edges.entries.flatMap { (from, tos) -> tos.map { it to from } }
            .groupBy({ it.first }, { it.second })
        val up = longest(reversed, sourceAppearance)
        val down = longest(edges.mapValues { it.value.toList() }, targetAppearance)
        val chain = up + 1 + down
        if (chain > MAX_DEPTH) {
            throw EditorRuleViolationException(
                "reference_too_deep",
                "The chain of references is longer than $MAX_DEPTH",
            )
        }
    }

    private fun edges(designSystemId: UUID, replacing: Source?): Map<UUID, Set<UUID>> {
        val invariantOwners = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.designSystemId eq designSystemId }
            .associate { it[InvariantPropertyValuesTable.id] to it[InvariantPropertyValuesTable.appearanceId] }
        val variationOwners = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.designSystemId eq designSystemId }
            .associate { it[VariationPropertyValuesTable.id] to it[VariationPropertyValuesTable.appearanceId] }
        val combinationOwners = StyleCombinationsTable.selectAll()
            .where { StyleCombinationsTable.designSystemId eq designSystemId }
            .associate { it[StyleCombinationsTable.id] to it[StyleCombinationsTable.appearanceId] }
        val result = mutableMapOf<UUID, MutableSet<UUID>>()
        val references = ComponentStyleReferencesTable.selectAll()
            .where { ComponentStyleReferencesTable.designSystemId eq designSystemId }.toList()
        references.forEach { row ->
            val invariant = row[ComponentStyleReferencesTable.invariantPropertyValueId]
            val variation = row[ComponentStyleReferencesTable.variationPropertyValueId]
            val combination = row[ComponentStyleReferencesTable.styleCombinationId]
            val replaced = (replacing is Source.Invariant && replacing.id == invariant) ||
                (replacing is Source.Variation && replacing.id == variation) ||
                (replacing is Source.Combination && replacing.id == combination)
            if (replaced) return@forEach
            val owner = invariant?.let(invariantOwners::get)
                ?: variation?.let(variationOwners::get)
                ?: combination?.let(combinationOwners::get)
            if (owner != null) {
                result.getOrPut(owner) { mutableSetOf() } += row[ComponentStyleReferencesTable.targetAppearanceId]
            }
        }
        return result
    }

    private fun reachable(edges: Map<UUID, Set<UUID>>, from: UUID, goal: UUID): Boolean {
        val seen = mutableSetOf<UUID>()
        val stack = ArrayDeque(listOf(from))
        while (stack.isNotEmpty()) {
            val node = stack.removeLast()
            if (node == goal) return true
            if (seen.add(node)) stack.addAll(edges[node].orEmpty())
        }
        return false
    }

    private fun longest(edges: Map<UUID, Collection<UUID>>, from: UUID, seen: Set<UUID> = emptySet()): Int {
        if (from in seen) return 0
        return edges[from].orEmpty().maxOfOrNull { 1 + longest(edges, it, seen + from) } ?: 0
    }

    private fun ensureDependency(parent: UUID, child: UUID) {
        if (parent == child) return
        val present = ComponentDependenciesTable.selectAll().where {
            (ComponentDependenciesTable.parentId eq parent) and (ComponentDependenciesTable.childId eq child)
        }.any()
        if (!present) {
            ComponentDependenciesTable.insertReturning {
                it[parentId] = parent
                it[childId] = child
                it[type] = RelationTypeDb.REUSE
            }.single()
        }
    }
}
