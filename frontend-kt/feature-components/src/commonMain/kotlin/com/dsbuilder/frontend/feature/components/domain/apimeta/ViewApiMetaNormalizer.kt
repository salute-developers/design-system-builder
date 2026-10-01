package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Приводит `uikit-api-meta.json` (мета Android View) к манифесту.
 *
 * Мету View генерирует Gradle-конвенция `GenerateUikitApiMetaTask` по `declare-styleable`; плагин `dsBuilder`
 * достаёт её из артефакта uikit проекта и перекодирует, опуская поля со значениями по умолчанию. Поэтому у
 * всех моделей чтения поля имеют значения по умолчанию: нормализатор читает и сырой файл генератора, и вывод
 * плагина. Правила:
 *
 * - запись описывает `declare-styleable`, а не компонент: параметры записи копируются в каждое имя из
 *   `componentNames`, а записи одного компонента (у 12 компонентов их две) сливаются по `(компонент, id)`.
 *   Побеждает первое вхождение; вхождение с другим типом попадает в `conflicts` результата;
 * - параметр типа `unknown` пропускается: у строковых атрибутов (`label`, `title`, анимации) нет
 *   темизируемого значения, и тип не входит в словарь БД. Записи с `subStyle` пропускаются целиком: это вторая
 *   семья стилей внутри компонента, а не его свойства. Пропуски попадают в `skipped` результата;
 * - платформенные имена — все `attrName` свойства в порядке появления без повторов (у `Avatar.width` это
 *   `android:minWidth` и `android:maxWidth`);
 * - описание — `attr: <attrName>` (при нескольких имён через `/`); `methodName` и `paramSimpleType` у View нет;
 * - состояния — `configName` из `stateSets`. `stateValues` на параметрах (переопределение значения в
 *   состоянии) и `sharedStates` (словарь drawable-атрибутов) состояний компонента не объявляют;
 * - компонент без свойств не попадает в манифест, потому что заводить его нечем.
 */
internal class ViewApiMetaNormalizer : ApiMetaNormalizer {
    private val json = Json { ignoreUnknownKeys = true }

    @Suppress("ReturnCount")
    override fun normalize(text: String, typeMap: Map<String, String>): ApiMetaNormalizationResult {
        val source = try {
            json.decodeFromString<ViewMeta>(text)
        } catch (exception: SerializationException) {
            return invalid(exception.message)
        } catch (exception: IllegalArgumentException) {
            return invalid(exception.message)
        }
        if (source.components.isEmpty()) {
            return ApiMetaNormalizationResult.Empty
        }

        val collected = collect(source, typeMap)
        val components = collected.byName
            .filterValues { it.properties.isNotEmpty() }
            .map { (name, component) ->
                ApiMetaComponent(
                    name = name,
                    properties = component.properties.map { (id, property) -> property.toManifest(id) },
                    states = component.states.toList(),
                )
            }
        if (components.isEmpty()) {
            return ApiMetaNormalizationResult.Empty
        }

        // Пара, свойство которой всё же попало в манифест из другой записи, пропущенной не считается.
        val kept = collected.byName
            .flatMap { (name, component) -> component.properties.keys.map { name to it } }
            .toSet()
        val skipped = listOf(
            ApiMetaSkipped(SKIPPED_UNKNOWN, (collected.unknownPairs - kept).size),
            ApiMetaSkipped(SKIPPED_SUB_STYLE, (collected.subStylePairs - kept).size),
        ).filter { it.count > 0 }

        return ApiMetaNormalizationResult.Normalized(ApiMetaManifest(components), collected.conflicts, skipped)
    }

    /** Проходит по записям: разворачивает имена, сливает свойства и собирает то, что нужно пропустить. */
    private fun collect(source: ViewMeta, typeMap: Map<String, String>): Collected {
        val collected = Collected()
        source.components.forEach { record ->
            record.componentNames.filter { it.isNotBlank() }.forEach { name ->
                val target = collected.byName.getOrPut(name) { MutableComponent() }
                record.params.filter { it.id.isNotBlank() }.forEach { param ->
                    collected.addParam(name, target, record, param, typeMap)
                }
                record.stateSets.flatMap { it.states }.map { it.configName }
                    .filterTo(target.states) { it.isNotBlank() }
            }
        }
        return collected
    }

    private fun Collected.addParam(
        componentName: String,
        target: MutableComponent,
        record: ViewMetaRecord,
        param: ViewMetaParam,
        typeMap: Map<String, String>,
    ) {
        when {
            record.subStyle != null -> subStylePairs += componentName to param.id
            param.type == UNKNOWN_TYPE || param.type.isBlank() -> unknownPairs += componentName to param.id
            else -> target.add(componentName, param, typeMap, conflicts)
        }
    }

    /** Результат прохода по записям до построения манифеста. */
    private class Collected {
        val conflicts = mutableListOf<String>()
        val byName = LinkedHashMap<String, MutableComponent>()
        val unknownPairs = LinkedHashSet<Pair<String, String>>()
        val subStylePairs = LinkedHashSet<Pair<String, String>>()
    }

    private fun invalid(reason: String?) = ApiMetaNormalizationResult.Invalid(
        "API meta is not a View meta object: ${reason ?: "unexpected shape"}.",
    )

    private fun MutableComponent.add(
        componentName: String,
        param: ViewMetaParam,
        typeMap: Map<String, String>,
        conflicts: MutableList<String>,
    ) {
        val type = typeMap[param.type] ?: param.type
        val known = properties[param.id]
        if (known == null) {
            properties[param.id] = MutableProperty(type).also { it.addAttr(param.attrName.ifBlank { param.id }) }
        } else if (known.type != type) {
            conflicts += "$componentName.${param.id}: kept ${known.type}, ignored $type"
        } else {
            known.addAttr(param.attrName.ifBlank { param.id })
        }
    }

    private class MutableComponent {
        val properties = LinkedHashMap<String, MutableProperty>()
        val states = LinkedHashSet<String>()
    }

    /**
     * Свойство в процессе сведения повторов: XML-атрибуты записей одного компонента накапливаются в порядке
     * появления (у `Spinner.size` их четыре: `android:minWidth`, `android:maxWidth`, `android:minHeight`,
     * `android:maxHeight`).
     */
    private class MutableProperty(val type: String) {
        private val attrNames = LinkedHashSet<String>()

        fun addAttr(attrName: String) {
            attrNames += attrName
        }

        fun toManifest(id: String) = ApiMetaProperty(
            name = id,
            type = type,
            platformNames = attrNames.toList(),
            description = attrNames.takeIf { it.isNotEmpty() }?.joinToString("/", prefix = "attr: "),
        )
    }

    private companion object {
        const val UNKNOWN_TYPE = "unknown"
        const val SKIPPED_UNKNOWN = "properties of type unknown"
        const val SKIPPED_SUB_STYLE = "properties of sub-style records"
    }
}

@Serializable
private data class ViewMeta(
    val components: List<ViewMetaRecord> = emptyList(),
)

@Serializable
private data class ViewMetaRecord(
    val componentNames: List<String> = emptyList(),
    val params: List<ViewMetaParam> = emptyList(),
    val subStyle: ViewMetaSubStyle? = null,
    val stateSets: List<ViewMetaStateSet> = emptyList(),
)

@Serializable
private data class ViewMetaParam(
    val id: String = "",
    val type: String = "",
    val attrName: String = "",
)

@Serializable
private data class ViewMetaSubStyle(
    val name: String = "",
)

@Serializable
private data class ViewMetaStateSet(
    val states: List<ViewMetaState> = emptyList(),
)

@Serializable
private data class ViewMetaState(
    val configName: String = "",
)
