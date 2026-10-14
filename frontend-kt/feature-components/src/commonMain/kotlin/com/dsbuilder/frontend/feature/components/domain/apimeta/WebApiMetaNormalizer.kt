package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Приводит `web-api-meta.json` (мета web) к манифесту.
 *
 * Мету web строит `npm run generate:api-meta` из `js/cli` по JSDoc-аннотациям словарей CSS-токенов пакета
 * компонентов (`@styleType`, `@styleProp`, `@stylePart`, `@styleState`). Запись меты — токен, а не свойство.
 * Правила:
 *
 * - токены сводятся в свойства по `(componentName, id)`: у свойства несколько токенов, когда это части
 *   типографики (`part`), состояния (`state`) или несколько CSS-переменных одного значения
 *   (`buttonLeftContentMargin` и `buttonRightContentMargin` у `Button.iconMargin`). Побеждает первое
 *   вхождение; вхождение с другим типом попадает в `conflicts` результата;
 * - платформенные имена — ключи токенов (`paramName`) без `state` в порядке появления: так web-параметры
 *   заводят сиды и так их ищет генерация web (`getWebTokenValue` по ключу токена). Токен с `state` несёт
 *   значение свойства в состоянии взаимодействия и отдельным именем не становится. Свойство, у которого
 *   есть только такие токены, пропускается и учитывается в `skipped`;
 * - описание — `token: <paramName>` (при нескольких токенах через `/`);
 * - состояния компонента — значения `state` в kebab-case, кроме состояний взаимодействия (`hovered`,
 *   `pressed` и др.): те общие для всех компонентов и в базе уже есть, а компонентное состояние с тем же
 *   именем было бы дублем;
 * - устаревание относится к токену, как у View к атрибуту: помечен только тот `paramName`, у которого есть
 *   `deprecated`; генератор пишет `{}` без сообщения, если в `@deprecated` нет `{@link}`;
 * - компонент без токенов (файл без словаря: `AvatarGroup`, `Image`) попадает в манифест без свойств: в пакете
 *   он есть, и в базе он нужен как компонент, к которому привязывается оформление. Мета пуста (`Empty`),
 *   только если в ней нет ни одного компонента.
 *
 * Мета Compose тоже список `{componentName, params}`, поэтому `paramName` обязателен: без него файл
 * Compose, переданный с `--platform react`, разобрался бы в манифест из чужих имён.
 */
internal class WebApiMetaNormalizer : ApiMetaNormalizer {
    private val json = Json { ignoreUnknownKeys = true }

    @Suppress("ReturnCount")
    override fun normalize(text: String, typeMap: Map<String, String>): ApiMetaNormalizationResult {
        val source = try {
            json.decodeFromString<List<WebMetaComponent>>(text)
        } catch (exception: SerializationException) {
            return invalid(exception.message)
        } catch (exception: IllegalArgumentException) {
            return invalid(exception.message)
        }
        val conflicts = mutableListOf<String>()
        val byName = LinkedHashMap<String, MutableComponent>()
        source.filter { it.componentName.isNotBlank() }.forEach { component ->
            val target = byName.getOrPut(component.componentName) { MutableComponent() }
            component.params.filter { it.id.isNotBlank() && it.type.isNotBlank() }.forEach { param ->
                target.add(component.componentName, param, typeMap, conflicts)
            }
        }

        var stateOnly = 0
        val components = byName.map { (name, component) ->
            val properties = component.properties.mapNotNull { (id, property) -> property.toManifest(id) }
            stateOnly += component.properties.size - properties.size
            ApiMetaComponent(name, properties, component.states.toList())
        }
        if (components.isEmpty()) {
            return ApiMetaNormalizationResult.Empty
        }

        val skipped = listOf(ApiMetaSkipped(SKIPPED_STATE_ONLY, stateOnly)).filter { it.count > 0 }
        return ApiMetaNormalizationResult.Normalized(ApiMetaManifest(components), conflicts, skipped)
    }

    private fun invalid(reason: String?) = ApiMetaNormalizationResult.Invalid(
        "API meta is not a list of web components: ${reason ?: "unexpected shape"}.",
    )

    private class MutableComponent {
        val properties = LinkedHashMap<String, MutableProperty>()
        val states = LinkedHashSet<String>()

        fun add(
            componentName: String,
            param: WebMetaParam,
            typeMap: Map<String, String>,
            conflicts: MutableList<String>,
        ) {
            val type = typeMap[param.type] ?: param.type
            val known = properties[param.id]
            when {
                known == null -> properties[param.id] = MutableProperty(type).also { it.addToken(param) }
                known.type != type -> {
                    conflicts += "$componentName.${param.id}: kept ${known.type}, ignored $type"
                    return
                }
                else -> known.addToken(param)
            }
            param.state?.toKebabCase()?.takeIf { it.isNotBlank() && it !in INTERACTION_STATES }?.let(states::add)
        }
    }

    /** Свойство в процессе сведения токенов: имена копятся в порядке появления, токены состояний не входят. */
    private class MutableProperty(val type: String) {
        private val tokens = LinkedHashSet<String>()
        private val deprecations = LinkedHashMap<String, ApiMetaDeprecation>()

        fun addToken(param: WebMetaParam) {
            if (param.state != null || param.paramName.isBlank()) return
            tokens += param.paramName
            if (param.deprecated != null && param.paramName !in deprecations) {
                deprecations[param.paramName] = ApiMetaDeprecation(param.deprecated.message)
            }
        }

        /** Свойство манифеста или `null`, если у него только токены состояний. */
        fun toManifest(id: String): ApiMetaProperty? = tokens.takeIf { it.isNotEmpty() }?.let {
            ApiMetaProperty(
                name = id,
                type = type,
                platformNames = it.toList(),
                description = it.joinToString("/", prefix = "token: "),
                deprecations = deprecations.toMap(),
            )
        }
    }

    private companion object {
        const val SKIPPED_STATE_ONLY = "properties with state tokens only"

        /** Словарь состояний взаимодействия из базовой миграции: у них `component_id` пуст. */
        val INTERACTION_STATES =
            setOf("pressed", "hovered", "focused", "selected", "activated", "readonly", "disabled")
    }
}

@Serializable
private data class WebMetaComponent(
    val componentName: String = "",
    val params: List<WebMetaParam> = emptyList(),
)

@Serializable
private data class WebMetaParam(
    // Обязателен: отличает мету web от меты Compose той же формы.
    val paramName: String,
    val id: String = "",
    val type: String = "",
    val state: String? = null,
    val deprecated: WebMetaDeprecation? = null,
)

@Serializable
private data class WebMetaDeprecation(
    val message: String = "",
)
