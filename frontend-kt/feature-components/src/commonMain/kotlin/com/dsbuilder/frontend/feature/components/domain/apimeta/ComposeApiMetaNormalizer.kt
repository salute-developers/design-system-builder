package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Приводит `uikit-compose-api-meta.json` к манифесту.
 *
 * Мету Compose генерирует KSP-процессор `api-info-ksp`; плагин `dsBuilder` достаёт её из артефакта
 * uikit проекта. Правила:
 *
 * - компоненты и свойства сводятся по `(componentName, id)`: один `id` повторяется, когда билдер
 *   принимает слот в нескольких перегрузках (`Color`, `InteractiveColor`, `StatefulValue`), и все такие
 *   повторы лежат в одной `group`; в базе у свойства группы нет. Побеждает первое
 *   вхождение; вхождение с другим типом попадает в `conflicts` результата;
 * - описание строится из `methodName` первого вхождения и всех встреченных `paramSimpleType`
 *   (`method: x; param: Color/InteractiveColor`). `group` в него не входит: это деталь раскладки
 *   параметров по блокам стиля для генератора, а не свойство слота. Тип параметра у перегрузок разный,
 *   поэтому берутся все типы, а не тип первого вхождения;
 * - платформенное имя (одно) равно `id`, как и у прежнего скрипта импорта. `methodName` — имя параметра
 *   метода билдера и у 58 параметров из 2315 отличается от `id`, поэтому в качестве имени не используется;
 * - состояние берётся из `stateEnum.values`: `configName`, если задан, иначе `name` в kebab-case
 *   нижнего регистра — в такой форме состояние встречается в конфигурациях оформления;
 * - компонент без параметров не попадает в манифест, потому что заводить его нечем.
 */
internal class ComposeApiMetaNormalizer : ApiMetaNormalizer {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Разбирает мету и строит манифест.
     *
     * @param text содержимое `uikit-compose-api-meta.json`.
     * @param typeMap подмена типа `from → to`, применяемая до отправки.
     */
    @Suppress("ReturnCount")
    override fun normalize(text: String, typeMap: Map<String, String>): ApiMetaNormalizationResult {
        val source = try {
            json.decodeFromString<List<ComposeMetaComponent>>(text)
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

        val conflicts = mutableListOf<String>()
        val byName = LinkedHashMap<String, MutableComponent>()
        source.filter { it.componentName.isNotBlank() }.forEach { component ->
            val target = byName.getOrPut(component.componentName) { MutableComponent() }
            component.params.filter { it.id.isNotBlank() && it.type.isNotBlank() }.forEach { param ->
                val type = typeMap[param.type] ?: param.type
                val known = target.properties[param.id]
                if (known == null) {
                    target.properties[param.id] = MutableProperty(type, param.methodName?.takeIf { it.isNotBlank() })
                        .also {
                            it.addParamType(param.paramSimpleType)
                            it.markDeprecated(param.deprecated)
                        }
                } else if (known.type != type) {
                    conflicts += "${component.componentName}.${param.id}: kept ${known.type}, ignored $type"
                } else {
                    known.addParamType(param.paramSimpleType)
                    known.markDeprecated(param.deprecated)
                }
            }
            component.stateEnum?.values.orEmpty()
                .map { it.toStateName() }
                .filterTo(target.states) { it.isNotBlank() }
        }

        val components = byName
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

        return ApiMetaNormalizationResult.Normalized(ApiMetaManifest(components), conflicts)
    }

    private fun ComposeMetaState.toStateName(): String =
        configName?.takeIf { it.isNotBlank() } ?: name.toKebabCase()

    private class MutableComponent {
        val properties = LinkedHashMap<String, MutableProperty>()
        val states = LinkedHashSet<String>()
    }

    /**
     * Свойство в процессе сведения повторов.
     *
     * Тип параметра у повторов различается: один и тот же слот приходит как `Color` в одной группе
     * и как `InteractiveColor` в другой (770 групп повторов в мете sdds.serv). Поэтому в описание
     * попадают все встреченные типы в порядке появления, а не тип случайного первого вхождения.
     */
    private class MutableProperty(val type: String, private val methodName: String?) {
        private val paramTypes = LinkedHashSet<String>()

        /**
         * Устаревание относится к свойству целиком: производитель меты распространяет пометку на все
         * перегрузки одного `id`, но если она всё же есть не у первого вхождения, достаточно любого.
         * Сообщение берётся у первого помеченного.
         */
        private var deprecation: ApiMetaDeprecation? = null

        fun markDeprecated(meta: ComposeMetaDeprecation?) {
            if (deprecation == null && meta != null) deprecation = ApiMetaDeprecation(meta.message)
        }

        fun addParamType(paramSimpleType: String?) {
            paramSimpleType?.takeIf { it.isNotBlank() }?.let(paramTypes::add)
        }

        fun toManifest(id: String): ApiMetaProperty {
            val parts = listOfNotNull(
                methodName?.let { "method: $it" },
                paramTypes.takeIf { it.isNotEmpty() }?.joinToString("/", prefix = "param: "),
            )
            return ApiMetaProperty(
                name = id,
                type = type,
                platformNames = listOf(id),
                description = parts.takeIf { it.isNotEmpty() }?.joinToString("; "),
                deprecations = deprecation?.let { mapOf(id to it) }.orEmpty(),
            )
        }
    }
}

/**
 * Приводит PascalCase и camelCase к kebab-case в нижнем регистре: `DraggingOver` → `dragging-over`.
 *
 * Дефис ставится там, где строчная буква или цифра встречает заглавную. Регулярное выражение с
 * просмотром назад не используется намеренно: правило должно одинаково работать на всех таргетах.
 */
internal fun String.toKebabCase(): String = buildString {
    this@toKebabCase.forEachIndexed { index, char ->
        if (char.isUpperCase() && index > 0) {
            val previous = this@toKebabCase[index - 1]
            if (previous.isLowerCase() || previous.isDigit()) append('-')
        }
        append(char.lowercaseChar())
    }
}

@Serializable
private data class ComposeMetaComponent(
    val componentName: String = "",
    val params: List<ComposeMetaParam> = emptyList(),
    val stateEnum: ComposeMetaStateEnum? = null,
)

@Serializable
private data class ComposeMetaParam(
    val id: String = "",
    val type: String = "",
    val methodName: String? = null,
    val paramSimpleType: String? = null,
    val deprecated: ComposeMetaDeprecation? = null,
)

@Serializable
internal data class ComposeMetaDeprecation(
    val message: String = "",
)

@Serializable
private data class ComposeMetaStateEnum(
    val values: List<ComposeMetaState> = emptyList(),
)

@Serializable
private data class ComposeMetaState(
    val name: String = "",
    val configName: String? = null,
)
