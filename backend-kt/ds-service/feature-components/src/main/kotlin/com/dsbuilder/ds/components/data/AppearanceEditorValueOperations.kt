package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorValueKind
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Операции редактора над значениями свойств оформления: область, набор состояний, токен и вложенная ссылка. */
@Suppress("TooManyFunctions")
internal class AppearanceEditorValueOperations(private val states: StateRepository) {
    /** Цель записи: найденная либо созданная строка значения. */
    private class Row(val kind: EditorValueKind, val id: UUID)

    /** Область значения: свойство, стили, оси стилей и состояния набора. */
    private class Scope(
        val property: ResultRow,
        val styleIds: List<UUID>,
        val axisIds: List<UUID>,
        val stateIds: List<UUID>,
    ) {
        val propertyId: UUID get() = property[PropertiesTable.id]
        val kind: EditorValueKind
            get() = when (styleIds.size) {
                0 -> EditorValueKind.INVARIANT
                1 -> EditorValueKind.VARIATION
                else -> EditorValueKind.COMBINATION
            }
    }

    suspend fun setPropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueSet,
    ): EditorPropertyValue? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val componentId = appearance[ComponentAppearancesTable.componentId]
        val scope = scope(appearanceId, componentId, command.scope)
        val propertyType = scope.property[PropertiesTable.type].wireValue
        val tokenType = tokenType(projectId, systemAdmin, designSystemId, command.tokenId)
        checkType(propertyType, tokenType ?: command.type ?: propertyType)
        val stateSetId = EditorSupport.resolveStateSet(states, scope.stateIds)
        val existing = find(appearanceId, scope, stateSetId)
        val reference = referenceOf(projectId, systemAdmin, appearance, propertyType, command, existing?.let(::source))
        val literal = (reference?.text ?: command.value).takeIf { command.tokenId == null }
        val row = existing ?: create(designSystemId, componentId, appearanceId, scope, stateSetId, command, literal)
        if (existing != null) update(designSystemId, existing, command, literal)
        linkProperty(scope.propertyId, scope.axisIds)
        StyleReferenceWriter.write(designSystemId, source(row), reference, componentId)
        return AppearanceEditorModelReader.read(projectId, systemAdmin, appearanceId, null)!!
            .propertyValues.first { it.id == row.id }
    }

    suspend fun removePropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueScope,
    ): Boolean {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return false
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val componentId = appearance[ComponentAppearancesTable.componentId]
        val scope = scope(appearanceId, componentId, command)
        val stateSetId = EditorSupport.resolveStateSet(states, scope.stateIds)
        val existing = find(appearanceId, scope, stateSetId) ?: return false
        remove(designSystemId, existing)
        return true
    }

    suspend fun reorderStates(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.StateOrder,
    ): List<EditorPropertyValue>? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val componentId = appearance[ComponentAppearancesTable.componentId]
        val scopeCommand = AppearanceEditorRepository.PropertyValueScope(
            command.propertyId,
            command.styleIds,
            emptyList(),
        )
        val scope = scope(appearanceId, componentId, scopeCommand)
        val emptySet = EditorSupport.emptyStateSet(states)
        val rows = rowsOf(appearanceId, scope).filter { it.second != emptySet }
        val wanted = command.states.map { names ->
            EditorSupport.resolveStateSet(states, EditorSupport.stateIds(componentId, names))
        }
        val existingSets = rows.map { it.second }
        val sameSets = wanted.toSet() == existingSets.toSet() && wanted.distinct().size == wanted.size
        if (wanted.size != rows.size || !sameSets) {
            throw EditorRuleViolationException(
                "invalid_order",
                "The order must list every state value of the property once",
            )
        }
        val byState = rows.associate { it.second to it.first }
        lockRows(designSystemId, rows.map { it.first })
        wanted.forEachIndexed { index, stateSet -> move(designSystemId, byState.getValue(stateSet), index + 1) }
        val model = AppearanceEditorModelReader.read(projectId, systemAdmin, appearanceId, null)!!
        val styles = scope.styleIds.sorted()
        return model.propertyValues.filter { it.propertyId == command.propertyId && it.styleIds.sorted() == styles }
    }

    // ---- область значения --------------------------------------------------------------------------------------

    private fun scope(
        appearanceId: UUID,
        componentId: UUID,
        command: AppearanceEditorRepository.PropertyValueScope,
    ): Scope {
        val property = PropertiesTable.selectAll().where {
            (PropertiesTable.id eq command.propertyId) and (PropertiesTable.componentId eq componentId)
        }.singleOrNull() ?: throw EditorRuleViolationException(
            "property_not_found",
            "The property does not belong to the component",
        )
        val styleIds = command.styleIds.distinct()
        val styleAxes = EditorSupport.styleAxes(appearanceId)
        val axes = styleIds.map { styleAxes[it] }
        if (axes.any { it == null } || axes.distinct().size != axes.size) {
            throw EditorRuleViolationException(
                "invalid_scope",
                "Styles must belong to distinct axes of the configuration",
            )
        }
        val axisIds = axes.filterNotNull()
        val axisVariations = AppearanceVariationsTable.selectAll()
            .where { AppearanceVariationsTable.id inList axisIds }
            .associate { it[AppearanceVariationsTable.id] to it[AppearanceVariationsTable.variationId] }
        return Scope(
            property,
            styleIds,
            axisIds.map { axisVariations.getValue(it) },
            EditorSupport.stateIds(componentId, command.states),
        )
    }

    // ---- проверки значения -------------------------------------------------------------------------------------

    private val numericTypes = setOf("integer", "float", "dimension", "value")
    private val paintTypes = setOf("color", "gradient")

    private fun checkType(slot: String, valueType: String) {
        val compatible = slot == valueType || (slot in numericTypes && valueType in numericTypes) ||
            (slot in paintTypes && valueType in paintTypes)
        if (!compatible) {
            throw EditorRuleViolationException(
                "incompatible_value_type",
                "A '$valueType' value does not fit a '$slot' property",
            )
        }
    }

    private fun tokenType(projectId: ProjectId, systemAdmin: Boolean, designSystemId: UUID, tokenId: UUID?): String? {
        if (tokenId == null) return null
        val token = ComponentTokensTable.selectAll().where { ComponentTokensTable.id eq tokenId }.singleOrNull()
        val tokenSystem = token?.get(ComponentTokensTable.designSystemId)
        val foreign = tokenSystem != null && tokenSystem != designSystemId
        if (token == null || foreign || !ComponentOwnership.canReadToken(projectId, systemAdmin, tokenId)) {
            throw EditorRuleViolationException("token_not_found", "The token is not available in this design system")
        }
        return token[ComponentTokensTable.type]
    }

    private fun referenceOf(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearance: ResultRow,
        propertyType: String,
        command: AppearanceEditorRepository.PropertyValueSet,
        replacing: StyleReferenceWriter.Source?,
    ): StyleReferenceWriter.Resolved? {
        val input = command.reference
        if (propertyType != "component_style") {
            if (input != null) {
                throw EditorRuleViolationException(
                    "reference_not_allowed",
                    "Only component_style properties carry references",
                )
            }
            return null
        }
        if (input == null) return null
        if (command.tokenId != null) {
            throw EditorRuleViolationException("reference_not_allowed", "A reference cannot be combined with a token")
        }
        return StyleReferenceWriter.resolve(projectId, systemAdmin, appearance, input, replacing)
    }

    // ---- поиск, создание, обновление -------------------------------------------------------------------------

    private fun find(appearanceId: UUID, scope: Scope, stateSetId: UUID): Row? =
        rowsOf(appearanceId, scope).firstOrNull { it.second == stateSetId }?.first

    /** Строки значений свойства в области с их наборами состояний. */
    private fun rowsOf(appearanceId: UUID, scope: Scope): List<Pair<Row, UUID>> = when (scope.kind) {
        EditorValueKind.INVARIANT -> InvariantPropertyValuesTable.selectAll().where {
            (InvariantPropertyValuesTable.appearanceId eq appearanceId) and
                (InvariantPropertyValuesTable.propertyId eq scope.propertyId)
        }.map {
            Row(EditorValueKind.INVARIANT, it[InvariantPropertyValuesTable.id]) to
                it[InvariantPropertyValuesTable.stateSetId]
        }
        EditorValueKind.VARIATION -> VariationPropertyValuesTable.selectAll().where {
            (VariationPropertyValuesTable.appearanceId eq appearanceId) and
                (VariationPropertyValuesTable.propertyId eq scope.propertyId) and
                (VariationPropertyValuesTable.styleId eq scope.styleIds.single())
        }.map {
            Row(EditorValueKind.VARIATION, it[VariationPropertyValuesTable.id]) to
                it[VariationPropertyValuesTable.stateSetId]
        }
        EditorValueKind.COMBINATION -> combinationRows(appearanceId, scope)
    }

    /** Сочетания области находятся по составу стилей, а не по ключу: ключ мог быть записан другим порядком. */
    private fun combinationRows(appearanceId: UUID, scope: Scope): List<Pair<Row, UUID>> {
        val rows = StyleCombinationsTable.selectAll().where {
            (StyleCombinationsTable.appearanceId eq appearanceId) and
                (StyleCombinationsTable.propertyId eq scope.propertyId)
        }.toList()
        if (rows.isEmpty()) return emptyList()
        val members = StyleCombinationMembersTable.selectAll()
            .where { StyleCombinationMembersTable.combinationId inList rows.map { it[StyleCombinationsTable.id] } }
            .groupBy({ it[StyleCombinationMembersTable.combinationId] }, { it[StyleCombinationMembersTable.styleId] })
        val wanted = scope.styleIds.toSet()
        return rows.filter { members[it[StyleCombinationsTable.id]].orEmpty().toSet() == wanted }.map {
            Row(EditorValueKind.COMBINATION, it[StyleCombinationsTable.id]) to it[StyleCombinationsTable.stateSetId]
        }
    }

    private fun nextPosition(appearanceId: UUID, scope: Scope): Int {
        val positions = when (scope.kind) {
            EditorValueKind.INVARIANT -> rowsOf(appearanceId, scope).map { (row, _) ->
                InvariantPropertyValuesTable.selectAll().where { InvariantPropertyValuesTable.id eq row.id }
                    .single()[InvariantPropertyValuesTable.position]
            }
            EditorValueKind.VARIATION -> rowsOf(appearanceId, scope).map { (row, _) ->
                VariationPropertyValuesTable.selectAll().where { VariationPropertyValuesTable.id eq row.id }
                    .single()[VariationPropertyValuesTable.position]
            }
            EditorValueKind.COMBINATION -> rowsOf(appearanceId, scope).map { (row, _) ->
                StyleCombinationsTable.selectAll().where { StyleCombinationsTable.id eq row.id }
                    .single()[StyleCombinationsTable.position]
            }
        }
        return positions.maxOrNull()?.plus(1) ?: 0
    }

    @Suppress("LongParameterList")
    private fun create(
        designSystemId: UUID,
        componentId: UUID,
        appearanceId: UUID,
        scope: Scope,
        stateSetId: UUID,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ): Row {
        val position = nextPosition(appearanceId, scope)
        return when (scope.kind) {
            EditorValueKind.INVARIANT ->
                createInvariant(
                    designSystemId,
                    componentId,
                    appearanceId,
                    scope,
                    stateSetId,
                    position,
                    command,
                    literal,
                )
            EditorValueKind.VARIATION ->
                createVariation(designSystemId, appearanceId, scope, stateSetId, position, command, literal)
            EditorValueKind.COMBINATION ->
                createCombination(designSystemId, appearanceId, scope, stateSetId, position, command, literal)
        }
    }

    @Suppress("LongParameterList")
    private fun createInvariant(
        designSystemId: UUID,
        componentId: UUID,
        appearanceId: UUID,
        scope: Scope,
        stateSetId: UUID,
        position: Int,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ): Row {
        val id = StableInvariantPropertyValuesTable.insertReturning {
            it[propertyId] = scope.propertyId
            it[StableInvariantPropertyValuesTable.designSystemId] = designSystemId
            it[StableInvariantPropertyValuesTable.componentId] = componentId
            it[StableInvariantPropertyValuesTable.appearanceId] = appearanceId
        }.single()[StableInvariantPropertyValuesTable.id]
        InvariantPropertyValueRevisionsTable.replaceRevision(
            InvariantPropertyValueRevisionsTable.entityId,
            id,
            designSystemId,
        ) {
            it[tokenId] = command.tokenId
            it[value] = literal
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[InvariantPropertyValueRevisionsTable.position] = position
            it[InvariantPropertyValueRevisionsTable.stateSetId] = stateSetId
        }
        return Row(EditorValueKind.INVARIANT, id)
    }

    @Suppress("LongParameterList")
    private fun createVariation(
        designSystemId: UUID,
        appearanceId: UUID,
        scope: Scope,
        stateSetId: UUID,
        position: Int,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ): Row {
        val id = StableVariationPropertyValuesTable.insertReturning {
            it[propertyId] = scope.propertyId
            it[styleId] = scope.styleIds.single()
            it[StableVariationPropertyValuesTable.appearanceId] = appearanceId
            it[StableVariationPropertyValuesTable.designSystemId] = designSystemId
        }.single()[StableVariationPropertyValuesTable.id]
        VariationPropertyValueRevisionsTable.replaceRevision(
            VariationPropertyValueRevisionsTable.entityId,
            id,
            designSystemId,
        ) {
            it[tokenId] = command.tokenId
            it[value] = literal
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[VariationPropertyValueRevisionsTable.position] = position
            it[VariationPropertyValueRevisionsTable.stateSetId] = stateSetId
        }
        return Row(EditorValueKind.VARIATION, id)
    }

    @Suppress("LongParameterList")
    private fun createCombination(
        designSystemId: UUID,
        appearanceId: UUID,
        scope: Scope,
        stateSetId: UUID,
        position: Int,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ): Row {
        val id = StableStyleCombinationsTable.insertReturning {
            it[propertyId] = scope.propertyId
            it[StableStyleCombinationsTable.appearanceId] = appearanceId
            it[StableStyleCombinationsTable.designSystemId] = designSystemId
        }.single()[StableStyleCombinationsTable.id]
        StyleCombinationRevisionsTable.replaceRevision(StyleCombinationRevisionsTable.entityId, id, designSystemId) {
            it[combinationKey] = EditorSupport.combinationKey(scope.styleIds)
            it[value] = literal.orEmpty()
            it[tokenId] = command.tokenId
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[StyleCombinationRevisionsTable.position] = position
            it[StyleCombinationRevisionsTable.stateSetId] = stateSetId
        }
        scope.styleIds.sorted().forEach { styleId ->
            val memberId = StableStyleCombinationMembersTable.insertReturning {
                it[combinationId] = id
                it[StableStyleCombinationMembersTable.designSystemId] = designSystemId
            }.single()[StableStyleCombinationMembersTable.id]
            StyleCombinationMemberRevisionsTable.replaceRevision(
                StyleCombinationMemberRevisionsTable.entityId,
                memberId,
                designSystemId,
            ) { it[StyleCombinationMemberRevisionsTable.styleId] = styleId }
        }
        return Row(EditorValueKind.COMBINATION, id)
    }

    private fun update(
        designSystemId: UUID,
        row: Row,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ) {
        lockRows(designSystemId, listOf(row))
        when (row.kind) {
            EditorValueKind.INVARIANT -> updateInvariant(designSystemId, row, command, literal)
            EditorValueKind.VARIATION -> updateVariation(designSystemId, row, command, literal)
            EditorValueKind.COMBINATION -> updateCombination(designSystemId, row, command, literal)
        }
    }

    private fun updateInvariant(
        designSystemId: UUID,
        row: Row,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ) {
        val current = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.id eq row.id }.single()
        val paths = changedPaths(
            Stored(
                current[InvariantPropertyValuesTable.tokenId],
                current[InvariantPropertyValuesTable.value],
                current[InvariantPropertyValuesTable.alpha],
                current[InvariantPropertyValuesTable.adjustment],
            ),
            command,
            literal,
        )
        if (paths.isEmpty()) return
        InvariantPropertyValueRevisionsTable.replaceRevision(
            InvariantPropertyValueRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = paths,
        ) {
            it[tokenId] = command.tokenId
            it[value] = literal
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[position] = current[InvariantPropertyValuesTable.position]
            it[stateSetId] = current[InvariantPropertyValuesTable.stateSetId]
        }
    }

    private fun updateVariation(
        designSystemId: UUID,
        row: Row,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ) {
        val current = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.id eq row.id }.single()
        val paths = changedPaths(
            Stored(
                current[VariationPropertyValuesTable.tokenId],
                current[VariationPropertyValuesTable.value],
                current[VariationPropertyValuesTable.alpha],
                current[VariationPropertyValuesTable.adjustment],
            ),
            command,
            literal,
        )
        if (paths.isEmpty()) return
        VariationPropertyValueRevisionsTable.replaceRevision(
            VariationPropertyValueRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = paths,
        ) {
            it[tokenId] = command.tokenId
            it[value] = literal
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[position] = current[VariationPropertyValuesTable.position]
            it[stateSetId] = current[VariationPropertyValuesTable.stateSetId]
        }
    }

    private fun updateCombination(
        designSystemId: UUID,
        row: Row,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ) {
        val current = StyleCombinationsTable.selectAll().where { StyleCombinationsTable.id eq row.id }.single()
        val token = current[StyleCombinationsTable.tokenId]
        val paths = changedPaths(
            Stored(
                token,
                current[StyleCombinationsTable.value].takeIf { token == null },
                current[StyleCombinationsTable.alpha],
                current[StyleCombinationsTable.adjustment],
            ),
            command,
            literal,
        )
        if (paths.isEmpty()) return
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = paths,
        ) {
            it[combinationKey] = current[StyleCombinationsTable.combinationKey]
            it[value] = literal.orEmpty()
            it[tokenId] = command.tokenId
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[position] = current[StyleCombinationsTable.position]
            it[stateSetId] = current[StyleCombinationsTable.stateSetId]
        }
    }

    /** Сохранённые поля значения, которые операция сравнивает с новыми. */
    private class Stored(val tokenId: UUID?, val value: String?, val alpha: String?, val adjustment: String?)

    private fun changedPaths(
        stored: Stored,
        command: AppearanceEditorRepository.PropertyValueSet,
        literal: String?,
    ): Set<String> = buildSet {
        if (stored.tokenId != command.tokenId) add("/token_id")
        if (stored.value != literal) add("/value")
        if (stored.alpha != command.alpha) add("/alpha")
        if (stored.adjustment != command.adjustment) add("/adjustment")
    }

    private fun move(designSystemId: UUID, row: Row, position: Int) {
        when (row.kind) {
            EditorValueKind.INVARIANT -> moveInvariant(designSystemId, row, position)
            EditorValueKind.VARIATION -> moveVariation(designSystemId, row, position)
            EditorValueKind.COMBINATION -> moveCombination(designSystemId, row, position)
        }
    }

    private fun moveInvariant(designSystemId: UUID, row: Row, position: Int) {
        val current = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.id eq row.id }.single()
        if (current[InvariantPropertyValuesTable.position] == position) return
        InvariantPropertyValueRevisionsTable.replaceRevision(
            InvariantPropertyValueRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = setOf("/position"),
        ) {
            it[tokenId] = current[InvariantPropertyValuesTable.tokenId]
            it[value] = current[InvariantPropertyValuesTable.value]
            it[alpha] = current[InvariantPropertyValuesTable.alpha]
            it[adjustment] = current[InvariantPropertyValuesTable.adjustment]
            it[InvariantPropertyValueRevisionsTable.position] = position
            it[stateSetId] = current[InvariantPropertyValuesTable.stateSetId]
        }
    }

    private fun moveVariation(designSystemId: UUID, row: Row, position: Int) {
        val current = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.id eq row.id }.single()
        if (current[VariationPropertyValuesTable.position] == position) return
        VariationPropertyValueRevisionsTable.replaceRevision(
            VariationPropertyValueRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = setOf("/position"),
        ) {
            it[tokenId] = current[VariationPropertyValuesTable.tokenId]
            it[value] = current[VariationPropertyValuesTable.value]
            it[alpha] = current[VariationPropertyValuesTable.alpha]
            it[adjustment] = current[VariationPropertyValuesTable.adjustment]
            it[VariationPropertyValueRevisionsTable.position] = position
            it[stateSetId] = current[VariationPropertyValuesTable.stateSetId]
        }
    }

    private fun moveCombination(designSystemId: UUID, row: Row, position: Int) {
        val current = StyleCombinationsTable.selectAll().where { StyleCombinationsTable.id eq row.id }.single()
        if (current[StyleCombinationsTable.position] == position) return
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            row.id,
            designSystemId,
            changedPaths = setOf("/position"),
        ) {
            it[combinationKey] = current[StyleCombinationsTable.combinationKey]
            it[value] = current[StyleCombinationsTable.value]
            it[tokenId] = current[StyleCombinationsTable.tokenId]
            it[alpha] = current[StyleCombinationsTable.alpha]
            it[adjustment] = current[StyleCombinationsTable.adjustment]
            it[StyleCombinationRevisionsTable.position] = position
            it[stateSetId] = current[StyleCombinationsTable.stateSetId]
        }
    }

    private fun remove(designSystemId: UUID, row: Row) {
        lockRows(designSystemId, listOf(row))
        StyleReferenceWriter.existing(source(row))?.let { StyleReferenceWriter.removeWithStyles(designSystemId, it) }
        when (row.kind) {
            EditorValueKind.INVARIANT -> removeInvariant(designSystemId, row)
            EditorValueKind.VARIATION -> removeVariation(designSystemId, row)
            EditorValueKind.COMBINATION -> removeCombination(designSystemId, row)
        }
    }

    private fun removeInvariant(designSystemId: UUID, row: Row) {
        val adjustments = InvariantPlatformParamAdjustmentsTable.selectAll()
            .where { InvariantPlatformParamAdjustmentsTable.ipvId eq row.id }.toList()
        lock(designSystemId, "invariant-platform-param-adjustment", adjustments) {
            it[InvariantPlatformParamAdjustmentsTable.id]
        }
        adjustments.forEach { EditorWrites.removeInvariantAdjustment(designSystemId, it) }
        EditorWrites.removeInvariantValue(
            designSystemId,
            InvariantPropertyValuesTable.selectAll().where { InvariantPropertyValuesTable.id eq row.id }.single(),
        )
    }

    private fun removeVariation(designSystemId: UUID, row: Row) {
        val adjustments = VariationPlatformParamAdjustmentsTable.selectAll()
            .where { VariationPlatformParamAdjustmentsTable.vpvId eq row.id }.toList()
        lock(designSystemId, "variation-platform-param-adjustment", adjustments) {
            it[VariationPlatformParamAdjustmentsTable.id]
        }
        adjustments.forEach { EditorWrites.removeVariationAdjustment(designSystemId, it) }
        EditorWrites.removeVariationValue(
            designSystemId,
            VariationPropertyValuesTable.selectAll().where { VariationPropertyValuesTable.id eq row.id }.single(),
        )
    }

    private fun removeCombination(designSystemId: UUID, row: Row) {
        val members = StyleCombinationMembersTable.selectAll()
            .where { StyleCombinationMembersTable.combinationId eq row.id }.toList()
        lock(designSystemId, "style-combination-member", members) { it[StyleCombinationMembersTable.id] }
        members.forEach { EditorWrites.removeCombinationMember(designSystemId, it) }
        EditorWrites.removeCombination(
            designSystemId,
            StyleCombinationsTable.selectAll().where { StyleCombinationsTable.id eq row.id }.single(),
        )
    }

    private fun lock(designSystemId: UUID, type: String, rows: List<ResultRow>, id: (ResultRow) -> UUID) {
        check(lockDraftSubjects(designSystemId, type, rows.map(id)))
    }

    private fun lockRows(designSystemId: UUID, rows: List<Row>) {
        rows.groupBy({ it.kind }, { it.id }).forEach { (kind, ids) ->
            val type = when (kind) {
                EditorValueKind.INVARIANT -> "invariant-property-value"
                EditorValueKind.VARIATION -> "variation-property-value"
                EditorValueKind.COMBINATION -> "style-combination"
            }
            check(lockDraftSubjects(designSystemId, type, ids))
        }
    }

    private fun source(row: Row): StyleReferenceWriter.Source = when (row.kind) {
        EditorValueKind.INVARIANT -> StyleReferenceWriter.Source.Invariant(row.id)
        EditorValueKind.VARIATION -> StyleReferenceWriter.Source.Variation(row.id)
        EditorValueKind.COMBINATION -> StyleReferenceWriter.Source.Combination(row.id)
    }

    /** Связывает свойство с вариациями осей области в каталоге, как это делает импорт. */
    private fun linkProperty(propertyId: UUID, variationIds: List<UUID>) {
        variationIds.forEach { variationId ->
            val present = PropertyVariationsTable.selectAll().where {
                (PropertyVariationsTable.propertyId eq propertyId) and
                    (PropertyVariationsTable.variationId eq variationId)
            }.any()
            if (!present) {
                PropertyVariationsTable.insertReturning {
                    it[PropertyVariationsTable.propertyId] = propertyId
                    it[PropertyVariationsTable.variationId] = variationId
                }.single()
            }
        }
    }
}
