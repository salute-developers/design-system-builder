package com.dsbuilder.frontend.cli.feature.components.domain.codec

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/**
 * Native-конфигурация компонента, которую потребляет Gradle-плагин `plugin_theme_builder`.
 *
 * Форма описана по фактическим данным `theme-converter`, а не по `config_scheme.json`:
 * схема датирована декабрём 2024 и не описывает ни `bindings`, ни `binding`, ни `key`.
 *
 * @property props инвариантные свойства компонента.
 * @property view значения цветовой схемы верхнего уровня.
 * @property bindings объявление осей вариаций.
 * @property variations декартово развёрнутые вариации.
 */
@Serializable
internal data class NativeConfig(
    val props: Map<String, NativeProperty> = emptyMap(),
    val view: Map<String, NativeViewEntry> = emptyMap(),
    val bindings: List<NativeBinding>? = null,
    val variations: List<NativeVariation> = emptyList(),
)

/**
 * Объявление одной оси вариаций.
 *
 * @property name имя оси, например `size` или `view`.
 * @property type вид оси: `enum`, `view` или `boolean`. Ось с типом `view` является цветовой схемой.
 * @property values объявленные значения оси. Может быть шире набора, встречающегося в вариациях.
 * @property defaultValue значение оси по умолчанию.
 */
@Serializable
internal data class NativeBinding(
    val name: String,
    val type: String? = null,
    val values: List<JsonPrimitive>? = null,
    val defaultValue: JsonPrimitive? = null,
)

/**
 * Ссылка на значение оси внутри `binding` вариации или записи `view`.
 *
 * Значение не всегда строка: оси с типом `boolean` используют `true` и `false`.
 *
 * @property name имя оси.
 * @property value значение оси.
 */
@Serializable
internal data class NativeBindingRef(
    val name: String,
    val value: JsonPrimitive,
)

/**
 * Запись цветовой схемы: набор свойств плюс необязательная ссылка на значение оси схемы.
 *
 * @property props свойства записи.
 * @property binding ссылка на значение оси цветовой схемы. Присутствует не во всех конфигурациях.
 */
@Serializable
internal data class NativeViewEntry(
    val props: Map<String, NativeProperty> = emptyMap(),
    val binding: List<NativeBindingRef>? = null,
)

/**
 * Одна декартова вариация: сочетание значений одной или нескольких осей.
 *
 * @property id идентификатор вариации. Не всегда выводится из `binding`.
 * @property parent идентификатор родительской вариации.
 * @property binding значения осей, задающие это сочетание. Последний элемент — собственная ось.
 * @property key дублирует имя собственной оси. Встречается у 55 вариаций корпуса.
 * @property props свойства сочетания.
 * @property view значения цветовой схемы внутри сочетания.
 */
@Serializable
internal data class NativeVariation(
    val id: JsonPrimitive? = null,
    val parent: String? = null,
    val binding: List<NativeBindingRef>? = null,
    val key: String? = null,
    val props: Map<String, NativeProperty> = emptyMap(),
    val view: Map<String, NativeViewEntry> = emptyMap(),
)

/**
 * Значение свойства компонента.
 *
 * Набор ключей закрыт и выверен по всем 500 конфигурациям корпуса: `type`, `value`, `default`,
 * `alpha`, `adjustment`, `states`. Тип принадлежит значению, а не определению свойства: одно и то
 * же свойство принимает `color` и `gradient` в зависимости от значения оси.
 *
 * @property type тип значения.
 * @property value значение для типов, ссылающихся на токен или литерал.
 * @property default значение для типов `color` и `gradient`.
 * @property alpha прозрачность.
 * @property adjustment поправка для типа `shape`.
 * @property states переопределения значения для состояний компонента.
 */
@Serializable
internal data class NativeProperty(
    val type: String,
    val value: JsonElement? = null,
    val default: JsonElement? = null,
    val alpha: JsonElement? = null,
    val adjustment: JsonElement? = null,
    val states: List<NativePropertyState>? = null,
)

/**
 * Переопределение значения свойства для набора состояний.
 *
 * Множество состояний не ограничено перечислением: корпус использует шестнадцать значений,
 * из них одиннадцать отсутствуют в `stateEnum` соседнего репозитория.
 *
 * @property state состояния, при которых действует переопределение.
 * @property value значение для этих состояний.
 * @property alpha прозрачность для этих состояний.
 * @property type тип значения, если он отличается от типа свойства.
 */
@Serializable
internal data class NativePropertyState(
    @SerialName("state") val states: List<String> = emptyList(),
    val value: JsonElement? = null,
    val alpha: JsonElement? = null,
    val type: String? = null,
)
