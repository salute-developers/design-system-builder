package com.dsbuilder.frontend.cli.feature.components.domain.codec

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
     * Идентификатор вариации в native-формате.
     *
     * Хранится, а не выводится: он авторский. Из 4600 сегментов корпуса под правило
     * «сегмент равен значению оси» подходят 3773, но 798 выглядят как `outer-label` у оси
     * `label-placement` со значением `outer`, а у булевых осей 187 сегментов равны имени оси
     * и ещё 125 — сокращению вроде `shadow` у `has-shadow`.
     *
     * Терять его нельзя: `plugin_theme_builder` строит из него имя генерируемого стиля
     * (`VariationNode.camelCaseName` разбивает `id` по точкам и переводит сегменты в CamelCase),
     * поэтому подмена `m.has-shadow` на `m.true` переименовывает публичный стиль темы.
     */
    val nativeId: String? = null,
    /**
     * Родитель вариации в native-формате.
     *
     * Тоже хранится, а не выводится: у `basic_button` в `sdds_sbcom` есть вариация с двумя осями
     * в `binding`, идентификатором `size-24` и `parent` равным `null` — из координаты такого
     * не вывести. Плагин строит по `parent` дерево наследования стилей.
     */
    val nativeParent: String? = null,
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
