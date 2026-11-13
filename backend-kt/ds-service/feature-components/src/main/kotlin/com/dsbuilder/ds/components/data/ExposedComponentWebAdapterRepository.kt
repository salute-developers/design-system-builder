package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentWebAdapterRepository
import com.dsbuilder.ds.components.domain.ComponentWebAdapterEntry
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Web-адаптер поверх нормализованной схемы компонентов.
 *
 * Временное решение локальной web-генерации: шаблоны web-параметров зависят от дизайн-системы,
 * compose-связи нужны раскладке пакета, а имя и описание компонента живут в базе. В общий ответ
 * выгрузки эти данные не входят, потому что её формат общий для платформ.
 */
class ExposedComponentWebAdapterRepository internal constructor() : ComponentWebAdapterRepository {
    override suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
    ): List<ComponentWebAdapterEntry>? {
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)) return null
        return entries(designSystemId, onlyKey = null)
    }

    override suspend fun loadComponent(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentName: String,
    ): ComponentWebAdapterEntry? {
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)) return null
        // Шаблоны и compose-связи считаются только для ключа компонента, а состав пакета — целиком:
        // от него зависят выбор записи среди одноимённых компонентов и список дочерних compose-компонентов.
        return entries(designSystemId, onlyKey = camelToKebab(componentName))
            .firstOrNull { it.name == componentName }
    }

    /** Записи адаптера; при [onlyKey] шаблоны и compose-связи собираются только для этого ключа. */
    private fun entries(designSystemId: UUID, onlyKey: String?): List<ComponentWebAdapterEntry> {
        // Состав тот же, что у выгрузки: компоненты, у которых в дизайн-системе есть appearance.
        val appearances = ComponentAppearancesTable.innerJoin(ComponentsTable).selectAll()
            .where { ComponentAppearancesTable.designSystemId eq designSystemId }
            .map {
                AdapterAppearance(
                    it[ComponentAppearancesTable.id],
                    it[ComponentAppearancesTable.name] ?: "default",
                    it[ComponentsTable.id],
                    it[ComponentsTable.name],
                    it[ComponentsTable.description],
                )
            }
        if (appearances.isEmpty()) return emptyList()

        val selected = onlyKey?.let { key -> appearances.filter { camelToKebab(it.componentName) == key } }
        val styles = styles(selected ?: appearances)
        val compose = composeDependencies(appearances, parentKey = onlyKey)
        // Сортировка обязательна: порядок строк из базы не определён, а повторный fetch не должен давать дифф.
        return appearances.sortedBy { it.componentName }
            .distinctBy { camelToKebab(it.componentName) }
            .filter { onlyKey == null || camelToKebab(it.componentName) == onlyKey }
            .map { appearance ->
                val key = camelToKebab(appearance.componentName)
                ComponentWebAdapterEntry(
                    componentName = key,
                    name = appearance.componentName,
                    description = appearance.componentDescription?.takeIf(String::isNotEmpty),
                    compose = compose[key].orEmpty(),
                    styles = styles[key].orEmpty(),
                )
            }
            .sortedBy { it.componentName }
    }

    /** Шаблоны по компонентам и стилям; стиль без шаблонов не попадает в результат. */
    private fun styles(appearances: List<AdapterAppearance>): Map<String, Map<String, StyleTemplates>> {
        val templates = webTemplates(appearances.map(AdapterAppearance::id))
        val result = mutableMapOf<String, MutableMap<String, StyleTemplates>>()
        appearances.sortedBy { it.styleName }.forEach { appearance ->
            val byProperty = templates[appearance.id] ?: return@forEach
            result.getOrPut(camelToKebab(appearance.componentName), ::sortedMapOf)[appearance.styleName] =
                byProperty.mapValues { (_, params) -> params.toSortedMap() }.toSortedMap()
        }
        return result
    }

    /**
     * Шаблоны web-параметров по appearance: свойство -> параметр -> шаблон.
     *
     * Шаблон хранится на строке поправки, то есть на конкретном значении, но описывает параметр
     * целиком. Расходящиеся шаблоны выразить в ответе нечем, поэтому берётся наименьший.
     */
    private fun webTemplates(appearanceIds: List<UUID>): Map<UUID, StyleTemplates> {
        val result = mutableMapOf<UUID, MutableMap<String, MutableMap<String, String>>>()
        (variationTemplates(appearanceIds) + invariantTemplates(appearanceIds)).forEach { row ->
            val params = result.getOrPut(row.appearanceId, ::mutableMapOf).getOrPut(row.propertyName, ::mutableMapOf)
            val current = params[row.paramName]
            if (current == null || row.template < current) params[row.paramName] = row.template
        }
        return result
    }

    private fun variationTemplates(appearanceIds: List<UUID>): List<TemplateRow> =
        VariationPlatformParamAdjustmentsTable
            .join(
                PropertyPlatformParamsTable,
                JoinType.INNER,
                VariationPlatformParamAdjustmentsTable.platformParamId,
                PropertyPlatformParamsTable.id,
            )
            .join(
                VariationPropertyValuesTable,
                JoinType.INNER,
                VariationPlatformParamAdjustmentsTable.vpvId,
                VariationPropertyValuesTable.id,
            )
            .join(PropertiesTable, JoinType.INNER, VariationPropertyValuesTable.propertyId, PropertiesTable.id)
            .selectAll()
            .where {
                (VariationPropertyValuesTable.appearanceId inList appearanceIds) and
                    (PropertyPlatformParamsTable.platform eq ComponentPlatformDb.WEB) and
                    VariationPlatformParamAdjustmentsTable.template.isNotNull()
            }
            .map {
                TemplateRow(
                    it[VariationPropertyValuesTable.appearanceId],
                    it[PropertiesTable.name],
                    it[PropertyPlatformParamsTable.name],
                    it[VariationPlatformParamAdjustmentsTable.template].orEmpty(),
                )
            }

    private fun invariantTemplates(appearanceIds: List<UUID>): List<TemplateRow> =
        InvariantPlatformParamAdjustmentsTable
            .join(
                PropertyPlatformParamsTable,
                JoinType.INNER,
                InvariantPlatformParamAdjustmentsTable.platformParamId,
                PropertyPlatformParamsTable.id,
            )
            .join(
                InvariantPropertyValuesTable,
                JoinType.INNER,
                InvariantPlatformParamAdjustmentsTable.ipvId,
                InvariantPropertyValuesTable.id,
            )
            .join(PropertiesTable, JoinType.INNER, InvariantPropertyValuesTable.propertyId, PropertiesTable.id)
            .selectAll()
            .where {
                (InvariantPropertyValuesTable.appearanceId inList appearanceIds) and
                    (PropertyPlatformParamsTable.platform eq ComponentPlatformDb.WEB) and
                    InvariantPlatformParamAdjustmentsTable.template.isNotNull()
            }
            .map {
                TemplateRow(
                    it[InvariantPropertyValuesTable.appearanceId],
                    it[PropertiesTable.name],
                    it[PropertyPlatformParamsTable.name],
                    it[InvariantPlatformParamAdjustmentsTable.template].orEmpty(),
                )
            }

    /**
     * Дочерние compose-компоненты: родитель -> дети в порядке связи.
     *
     * Связь глобальная, поэтому отдаётся только между компонентами пакета: ребёнка, которого в пакете
     * нет, генератору раскладывать незачем.
     */
    private fun composeDependencies(
        appearances: List<AdapterAppearance>,
        parentKey: String? = null,
    ): Map<String, List<String>> {
        val names = appearances.associate { it.componentId to camelToKebab(it.componentName) }
        val componentIds = names.keys.toList()
        val parentIds = parentKey?.let { key -> names.filterValues { it == key }.keys.toList() } ?: componentIds
        return ComponentDependenciesTable.selectAll()
            .where {
                (ComponentDependenciesTable.type eq RelationTypeDb.COMPOSE) and
                    (ComponentDependenciesTable.parentId inList parentIds) and
                    (ComponentDependenciesTable.childId inList componentIds)
            }
            .map {
                ComposeChild(
                    names.getValue(it[ComponentDependenciesTable.parentId]),
                    names.getValue(it[ComponentDependenciesTable.childId]),
                    it[ComponentDependenciesTable.order] ?: 0,
                )
            }
            .groupBy(ComposeChild::parent)
            .mapValues { (_, children) ->
                children.sortedWith(compareBy(ComposeChild::order, ComposeChild::name)).map(ComposeChild::name)
            }
    }

    private data class AdapterAppearance(
        val id: UUID,
        val styleName: String,
        val componentId: UUID,
        val componentName: String,
        val componentDescription: String?,
    )

    private data class TemplateRow(
        val appearanceId: UUID,
        val propertyName: String,
        val paramName: String,
        val template: String,
    )

    private data class ComposeChild(val parent: String, val name: String, val order: Int)
}

/** Шаблоны одного стиля: свойство -> web-параметр -> шаблон. */
private typealias StyleTemplates = Map<String, Map<String, String>>
