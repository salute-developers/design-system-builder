package com.dsbuilder.frontend.cli.feature.components.domain

import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonConfig
import kotlinx.serialization.Serializable

/**
 * Пакет конфигураций компонентов одной дизайн-системы.
 *
 * `meta.json` неотделим от конфигураций: он задаёт состав пакета и идентичность каждого
 * компонента, поэтому передаётся вместе с ними.
 *
 * @property name имя из `meta.json`.
 * @property origin разрешённый источник пакета для вывода перед отправкой.
 * @property configurations конфигурации в порядке их перечисления в `meta.json`.
 */
internal data class ComponentPackage(
    val name: String,
    val origin: String,
    val configurations: List<ComponentConfiguration>,
)

/**
 * Одна конфигурация компонента вместе с её идентичностью.
 *
 * Идентичность — пара `componentName` и `styleName`: `componentName` не уникален, например
 * `badge` в `sdds_serv` соответствуют `badge-clear`, `badge-solid` и `badge-transparent`.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property fileName имя файла конфигурации внутри пакета.
 * @property nativeConfig текст native-конфигурации.
 */
internal data class ComponentConfiguration(
    val componentName: String,
    val styleName: String,
    val fileName: String,
    val nativeConfig: String,
)

/**
 * Конфигурация компонента, преобразованная в common-формат, вместе с её идентичностью.
 *
 * Идентичность переносится из [ComponentConfiguration]: без неё backend не сопоставит конфигурацию
 * с компонентом и стилем.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property config конфигурация в common-формате.
 */
internal data class ConvertedComponentConfig(
    val componentName: String,
    val styleName: String,
    val config: CommonConfig,
)

/**
 * Содержимое `meta.json`.
 *
 * @property name имя, которым пакет называет свою дизайн-систему.
 * @property version объявленная версия. Не используется как версия пакета: в архиве `0.18.0.zip`
 *   это поле содержит `0.6.0-rc`, то есть не поддерживается.
 * @property components состав пакета.
 */
@Serializable
internal data class ComponentPackageMeta(
    val name: String,
    val version: String? = null,
    val components: List<ComponentPackageMetaEntry> = emptyList(),
)

/**
 * Запись состава пакета.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property config имя файла конфигурации.
 */
@Serializable
internal data class ComponentPackageMetaEntry(
    val componentName: String,
    val styleName: String,
    val config: String,
)

/**
 * Результат чтения пакета из источника.
 */
internal sealed interface ComponentPackageResult {
    /**
     * Пакет прочитан.
     *
     * @property value прочитанный пакет.
     */
    data class Loaded(
        val value: ComponentPackage,
    ) : ComponentPackageResult

    /**
     * Пакет не прочитан. Частичный результат не возвращается.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ComponentPackageResult
}
