package com.dsbuilder.frontend.feature.components.domain.codec

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

/**
 * Common-конфигурация компонента — модель DS Builder.
 *
 * Форма описана по `common_config_scheme.json`, обновлённой в апреле 2026. В частности,
 * свойства значения вариации лежат под ключом `properties`, а не `props`.
 *
 * @property rootVariationId идентификатор корневой оси.
 * @property colorSchemeVariationId идентификатор оси, играющей роль цветовой схемы.
 * @property invariants свойства, не зависящие от вариаций.
 * @property defaults значения осей по умолчанию.
 * @property variations оси вариаций со своими значениями.
 */
@Serializable
internal data class CommonConfig(
    val rootVariationId: String? = null,
    val colorSchemeVariationId: String? = null,
    val invariants: Map<String, NativeProperty> = emptyMap(),
    val defaults: List<CommonDefault> = emptyList(),
    val variations: List<CommonVariation> = emptyList(),
)

/**
 * Значение оси по умолчанию на уровне конфигурации.
 *
 * @property id идентификатор оси.
 * @property value значение по умолчанию.
 */
@Serializable
internal data class CommonDefault(
    val id: String,
    val value: JsonPrimitive,
)

/**
 * Ось вариаций со списком своих значений.
 *
 * @property id идентификатор оси.
 * @property name имя оси, например `size` или `view`.
 * @property values значения оси.
 */
@Serializable
internal data class CommonVariation(
    val id: String,
    val name: String,
    val values: List<CommonVariationValue> = emptyList(),
    /**
     * Тип оси, объявленный конфигурацией в `bindings[].type`.
     *
     * Возится отдельно от роли оси схемы, потому что это независимые факты: роль говорит, куда
     * уезжают значения, тип — как ось объявлена. В `sdds_serv` они всегда совпадают, и оттого
     * прежде тип выводился из роли; в `sdds_sbcom` 10 осей объявлены `enum`, а значения держат
     * в `view`, и вывод из роли переименовывал их в `view`.
     *
     * `null` означает, что тип не объявлен и его следует вывести из набора значений.
     */
    val declaredType: String? = null,
)

/**
 * Одно значение оси вместе со свойствами, которые оно задаёт.
 *
 * @property name имя значения, например `xl` для оси `size`.
 * @property targets значения других осей, с которыми пересекается это значение.
 * @property properties свойства, действующие при этом сочетании.
 */
@Serializable
internal data class CommonVariationValue(
    val name: String,
    val targets: List<CommonTarget>? = null,
    val properties: Map<String, NativeProperty> = emptyMap(),
    /**
     * Идентификатор, написанный автором конфигурации: `variations[].id` у обычной вариации
     * и ключ записи у значения оси цветовой схемы.
     *
     * Хранится, а не выводится, потому что правила сборки у него нет. Два способа обойтись
     * без хранения проверены на корпусе и отвергнуты: переименование значений осей под сегменты
     * оставляет 215 случаев из 1219, а словарь `(ось, значение) -> сегмент` не решает
     * 11 конфигураций из 191 — в `note_config.json` две оси слиты в один сегмент
     * `has-close-content-scalable` через дефис, а не разделены точкой.
     *
     * Терять его нельзя: `plugin_theme_builder` строит из него имя генерируемого стиля
     * (`VariationNode.camelCaseName` разбивает `id` по точкам и переводит сегменты в CamelCase),
     * поэтому подмена `m.has-shadow` на `m.true` переименовывает публичный стиль темы.
     *
     * Родитель рядом не хранится: он выводится как самый длинный точечный префикс
     * идентификатора, принадлежащий другой вариации, — правило точно на 1219 из 1219.
     */
    val authoredId: String? = null,
)

/**
 * Пересечение с другими осями.
 *
 * @property properties значения других осей, образующие сочетание.
 */
@Serializable
internal data class CommonTarget(
    val properties: List<CommonTargetProperty> = emptyList(),
)

/**
 * Значение другой оси в составе сочетания.
 *
 * @property id идентификатор оси.
 * @property value значение этой оси.
 */
@Serializable
internal data class CommonTargetProperty(
    val id: String,
    val value: JsonPrimitive,
)
