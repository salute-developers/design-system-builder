package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.CoreProblemAdjustment
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Стабильные имена нужны только для диагностики отсутствующих сущностей, не для валидации API. */
internal object DiagnosticComponentsTable : Table("components") {
    val id = uuid("id")
    val name = text("name")
    val platform = text("platform")
}

/** Состояние, используемое сохранённым назначением, читается до фильтрации по Core. */
internal object DiagnosticStatesTable : Table("states") {
    val id = uuid("id")
    val componentId = uuid("component_id").nullable()
    val name = text("name")
}

/** Стабильный ключ свойства не доказывает его наличие в Core. */
internal object DiagnosticPropertiesTable : Table("properties") {
    val id = uuid("id")
    val name = text("name")
}

/** Справочники выбранного Core для проверки всего отчёта одним набором. */
internal class CoreCompatibilityCatalog(designSystemId: UUID, versionId: UUID?) {
    val activeComponents = DesignSystemComponentsTable.selectAll()
        .where { DesignSystemComponentsTable.designSystemId eq designSystemId }
        .mapTo(hashSetOf()) { it[DesignSystemComponentsTable.componentId] }
    private val diagnosticComponents = DiagnosticComponentsTable.selectAll().toList()
    val componentNames = diagnosticComponents.associate {
        it[DiagnosticComponentsTable.id] to it[DiagnosticComponentsTable.name]
    }
    val componentPlatforms = diagnosticComponents.associate {
        it[DiagnosticComponentsTable.id] to it[DiagnosticComponentsTable.platform]
    }
    val availableComponents = TransactionManager.current().exec(
        "SELECT c.component_id FROM core_release_components c JOIN core_releases r ON r.id = c.release_id " +
            "WHERE c.release_id = ds_selected_core_release(r.platform)",
    ) { rows -> buildSet { while (rows.next()) add(rows.getObject(1, UUID::class.java)) } }.orEmpty()
    val properties = PropertiesTable.selectAll().associateBy { it[PropertiesTable.id] }
    val componentTargets = TransactionManager.current().exec(
        "SELECT p.property_id, p.component_targets FROM core_release_properties p " +
            "JOIN core_releases r ON r.id = p.release_id WHERE p.release_id = ds_selected_core_release(r.platform)",
    ) { rows ->
        buildMap {
            while (rows.next()) {
                val targets = Json.parseToJsonElement(rows.getString(2)).jsonArray.map { it.jsonPrimitive.content }
                put(rows.getObject(1, UUID::class.java), targets)
            }
        }
    }.orEmpty()
    val propertyNames = DiagnosticPropertiesTable.selectAll()
        .associate { it[DiagnosticPropertiesTable.id] to it[DiagnosticPropertiesTable.name] }
    val states = ComponentStatesTable.selectAll().associateBy { it[ComponentStatesTable.id] }
    val stateNames = DiagnosticStatesTable.selectAll()
        .associate { it[DiagnosticStatesTable.id] to it[DiagnosticStatesTable.name] }
    val sets = ComponentStateSetsTable.selectAll()
        .associate { it[ComponentStateSetsTable.id] to it[ComponentStateSetsTable.stateIds] }
    val params = PropertyPlatformParamsTable.selectAll().associateBy { it[PropertyPlatformParamsTable.id] }
    val tokens = ComponentTokensTable.selectAll()
        .where { ComponentTokensTable.designSystemId eq designSystemId }.associateBy { it[ComponentTokensTable.id] }
    val appearances = ComponentAppearancesTable.selectAll()
        .where { ComponentAppearancesTable.designSystemId eq designSystemId }
        .associateBy { it[ComponentAppearancesTable.id] }
    val styles = ComponentStylesTable.selectAll()
        .where { ComponentStylesTable.designSystemId eq designSystemId }.associateBy { it[ComponentStylesTable.id] }
    val adjustments = adjustments(designSystemId, versionId)

    private fun adjustments(designSystemId: UUID, versionId: UUID?): Map<UUID, List<CoreProblemAdjustment>> {
        val result = mutableMapOf<UUID, MutableList<CoreProblemAdjustment>>()
        val invariants = InvariantPlatformParamAdjustmentsTable.selectAll().toList()
        val variations = VariationPlatformParamAdjustmentsTable.selectAll().toList()
        val invariantRevisions = EditorSupport.revisions(
            designSystemId,
            versionId,
            "invariant-platform-param-adjustment",

            invariants.map { it[InvariantPlatformParamAdjustmentsTable.id] },
        )
        val variationRevisions = EditorSupport.revisions(
            designSystemId,
            versionId,
            "variation-platform-param-adjustment",

            variations.map { it[VariationPlatformParamAdjustmentsTable.id] },
        )
        invariants.forEach { row ->
            val id = row[InvariantPlatformParamAdjustmentsTable.id]
            result.getOrPut(
                row[InvariantPlatformParamAdjustmentsTable.ipvId],
                ::mutableListOf,
            ).add(
                CoreProblemAdjustment(
                    id,
                    row[InvariantPlatformParamAdjustmentsTable.platformParamId],
                    invariantRevisions[id],
                    row[InvariantPlatformParamAdjustmentsTable.value],
                    row[InvariantPlatformParamAdjustmentsTable.template],
                ),
            )
        }
        variations.forEach { row ->
            val id = row[VariationPlatformParamAdjustmentsTable.id]
            result.getOrPut(
                row[VariationPlatformParamAdjustmentsTable.vpvId],
                ::mutableListOf,
            ).add(
                CoreProblemAdjustment(
                    id,
                    row[VariationPlatformParamAdjustmentsTable.platformParamId],
                    variationRevisions[id],
                    row[VariationPlatformParamAdjustmentsTable.value],
                    row[VariationPlatformParamAdjustmentsTable.template],
                ),
            )
        }
        return result
    }
}
