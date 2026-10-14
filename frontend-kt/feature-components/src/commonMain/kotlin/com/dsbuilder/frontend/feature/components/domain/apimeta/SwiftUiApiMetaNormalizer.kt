package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Приводит `ios-api-meta.json` к манифесту.
 *
 * Мету iOS снимает SwiftSyntax-сканер репозитория платформы: он раскрывает публичные свойства
 * `*Appearance`-структур. Правила:
 *
 * - компоненты и свойства сводятся по `(componentName, id)`, где `id` — ключ свойства в конфигурации
 *   оформления. Побеждает первое вхождение; вхождение с другим типом попадает в `conflicts`;
 * - платформенное имя — `methodName`, имя stored-property в коде. `id` для этого не годится: он
 *   отличается от имени в коде у 290 свойств из 903 (`titleStyle` против `titleTypography`);
 * - повторы одного `id` с тем же типом сливаются, а их имена складываются в `platformNames`: один
 *   ключ конфигурации раскладывается по нескольким свойствам кода, когда у него есть состояние
 *   (`toggleIconColor` → `toggleColorChecked`, `toggleColorIndeterminate`) или уточнение
 *   (`titleStyle` → `titleTypography`, `titleTypographyCollapsed`);
 * - параметры без кода на платформе пропускаются: у них пуст `methodName` или задан `unmapped`.
 *   Такой параметр описывает свойство, которое знает дизайн-система, но не реализует библиотека,
 *   и темизировать на iOS его нечем;
 * - описание строится из `group`, `methodName` и `paramSimpleType`; значения, различающиеся у
 *   повторов, перечисляются через `/` в порядке появления. `group` входит в описание, потому что
 *   на iOS она различает свойство самого appearance (`root`) и свойство конфигурации размеров
 *   (`size`), и это видно в коде платформы;
 * - состояние берётся из `stateEnum.values`: `configName`, если задан, иначе `name` в kebab-case
 *   нижнего регистра. Поле `state` отдельного параметра состоянием компонента не считается: оно
 *   говорит, из какого состояния ключа брать значение, и среди таких состояний есть состояния
 *   взаимодействия, чей словарь в базе общий;
 * - служебные признаки генератора (`copyOf`, `fromVariation`, `valueEnum`, `markupValue`,
 *   `markupZero`, `rawNumber`, `alwaysEmit`, `stateOnly`, `sizeFromIconId`) описывают, как генератор
 *   добывает значение из конфигурации, и в манифест не идут;
 * - компонент без свойств не попадает в манифест, потому что заводить его нечем.
 *
 * Устаревание мета iOS не отдаёт: свойства, которых нет в конфигурациях оформления, из неё убраны
 * на стороне генератора, поэтому помечать нечего.
 */
internal class SwiftUiApiMetaNormalizer : ApiMetaNormalizer {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Разбирает мету и строит манифест.
     *
     * @param text содержимое `ios-api-meta.json`.
     * @param typeMap подмена типа `from → to`, применяемая до отправки.
     */
    @Suppress("ReturnCount")
    override fun normalize(text: String, typeMap: Map<String, String>): ApiMetaNormalizationResult {
        val source = try {
            json.decodeFromString<List<SwiftUiMetaComponent>>(text)
        } catch (exception: SerializationException) {
            return ApiMetaNormalizationResult.Invalid(
                "API meta is not a list of components: ${exception.message ?: "unexpected shape"}.",
            )
        } catch (exception: IllegalArgumentException) {
            return ApiMetaNormalizationResult.Invalid(
                "API meta is not a list of components: ${exception.message ?: "unexpected shape"}.",
            )
        }
        if (source.isEmpty()) {
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

        // Пара, свойство которой всё же попало в манифест из другого вхождения, пропущенной не считается.
        val kept = collected.byName
            .flatMap { (name, component) -> component.properties.keys.map { name to it } }
            .toSet()
        val skipped = listOf(ApiMetaSkipped(SKIPPED_UNMAPPED, (collected.unmappedPairs - kept).size))
            .filter { it.count > 0 }

        return ApiMetaNormalizationResult.Normalized(ApiMetaManifest(components), collected.conflicts, skipped)
    }

    /** Проходит по записям: сливает повторы свойств и собирает то, что нужно пропустить. */
    private fun collect(source: List<SwiftUiMetaComponent>, typeMap: Map<String, String>): Collected {
        val collected = Collected()
        source.filter { it.componentName.isNotBlank() }.forEach { component ->
            val target = collected.byName.getOrPut(component.componentName) { MutableComponent() }
            component.params.filter { it.id.isNotBlank() && it.type.isNotBlank() }.forEach { param ->
                if (param.unmapped == true || param.methodName.isNullOrBlank()) {
                    collected.unmappedPairs += component.componentName to param.id
                    return@forEach
                }
                val type = typeMap[param.type] ?: param.type
                val known = target.properties[param.id]
                if (known == null) {
                    target.properties[param.id] = MutableProperty(type).also { it.add(param) }
                } else if (known.type != type) {
                    collected.conflicts += "${component.componentName}.${param.id}: kept ${known.type}, ignored $type"
                } else {
                    known.add(param)
                }
            }
            component.stateEnum?.values.orEmpty()
                .map { it.toStateName() }
                .filterTo(target.states) { it.isNotBlank() }
        }
        return collected
    }

    private fun SwiftUiMetaState.toStateName(): String =
        configName?.takeIf { it.isNotBlank() } ?: name.toKebabCase()

    private class Collected {
        val byName = LinkedHashMap<String, MutableComponent>()
        val conflicts = mutableListOf<String>()
        val unmappedPairs = mutableSetOf<Pair<String, String>>()
    }

    private class MutableComponent {
        val properties = LinkedHashMap<String, MutableProperty>()
        val states = LinkedHashSet<String>()
    }

    /**
     * Свойство в процессе сведения повторов.
     *
     * Имена, группы и типы параметра складываются по всем вхождениям: повтор означает, что один ключ
     * конфигурации обслуживает несколько свойств кода, и ни одно из имён терять нельзя — backend
     * хранит у свойства список платформенных имён.
     */
    private class MutableProperty(val type: String) {
        private val methodNames = LinkedHashSet<String>()
        private val groups = LinkedHashSet<String>()
        private val paramTypes = LinkedHashSet<String>()

        fun add(param: SwiftUiMetaParam) {
            param.methodName?.takeIf { it.isNotBlank() }?.let(methodNames::add)
            param.group?.takeIf { it.isNotBlank() }?.let(groups::add)
            param.paramSimpleType?.takeIf { it.isNotBlank() }?.let(paramTypes::add)
        }

        fun toManifest(id: String): ApiMetaProperty {
            val parts = listOfNotNull(
                groups.takeIf { it.isNotEmpty() }?.joinToString("/", prefix = "group: "),
                methodNames.takeIf { it.isNotEmpty() }?.joinToString("/", prefix = "method: "),
                paramTypes.takeIf { it.isNotEmpty() }?.joinToString("/", prefix = "param: "),
            )
            return ApiMetaProperty(
                name = id,
                type = type,
                platformNames = methodNames.toList(),
                description = parts.takeIf { it.isNotEmpty() }?.joinToString("; "),
            )
        }
    }

    internal companion object {
        /** Категория пропущенного: свойство дизайн-системы, которого нет в коде платформы. */
        const val SKIPPED_UNMAPPED = "properties without platform code"
    }
}

@Serializable
private data class SwiftUiMetaComponent(
    val componentName: String = "",
    val params: List<SwiftUiMetaParam> = emptyList(),
    val stateEnum: SwiftUiMetaStateEnum? = null,
)

@Serializable
private data class SwiftUiMetaParam(
    val id: String = "",
    val type: String = "",
    val group: String? = null,
    val methodName: String? = null,
    val paramSimpleType: String? = null,
    val unmapped: Boolean? = null,
)

@Serializable
private data class SwiftUiMetaStateEnum(
    val values: List<SwiftUiMetaState> = emptyList(),
)

@Serializable
private data class SwiftUiMetaState(
    val name: String = "",
    val configName: String? = null,
)
