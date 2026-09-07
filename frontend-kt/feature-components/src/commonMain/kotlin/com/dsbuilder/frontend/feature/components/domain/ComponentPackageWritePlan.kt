package com.dsbuilder.frontend.feature.components.domain

import com.dsbuilder.frontend.feature.components.domain.codec.CommonConfig
import com.dsbuilder.frontend.feature.components.domain.codec.NativeConfig

/**
 * Пакет конфигураций, выгруженный из дизайн-системы.
 *
 * Конфигурации приходят в common-формате: их ещё предстоит преобразовать кодеком, и до этого
 * момента модель ничего не знает о том, как они лягут на диск.
 *
 * @property name имя дизайн-системы.
 * @property version версия последней опубликованной записи.
 * @property configurations выгруженные конфигурации.
 * @property underivedTypes значения, вид заливки которых модель не смогла вывести: ссылка
 *   на токен не разрешилась, и отдан тип свойства. Печатается, а не умалчивается — иначе
 *   градиент молча уедет в тему сплошным цветом.
 */
internal data class ExportedComponentPackage(
    val name: String,
    val version: String,
    val configurations: List<ExportedComponentConfig>,
    val underivedTypes: List<String> = emptyList(),
)

/**
 * Одна выгруженная конфигурация вместе с её идентичностью.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля, оно же имя appearance.
 * @property config конфигурация в common-формате.
 */
internal data class ExportedComponentConfig(
    val componentName: String,
    val styleName: String,
    val config: CommonConfig,
)

/**
 * Конфигурация, уже преобразованная кодеком в native-формат.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property config native-конфигурация.
 */
internal data class RenderedComponentConfig(
    val componentName: String,
    val styleName: String,
    val config: NativeConfig,
)

/**
 * Состояние целевой директории до записи.
 *
 * Читается частично: `meta.json` нужен ради имён файлов, которые правилом не выводятся,
 * а перечень файлов — ради вычисления несвязанных. Отсутствие `meta.json` отказом
 * не является: в пустую директорию пакет пишется целиком.
 *
 * @property entries записи существующего `meta.json`.
 * @property fileNames имена файлов конфигураций, найденные в директории.
 */
internal data class ExistingComponentPackage(
    val entries: List<ComponentPackageMetaEntry> = emptyList(),
    val fileNames: List<String> = emptyList(),
)

/**
 * Файл, который предстоит записать.
 *
 * @property fileName имя файла внутри целевой директории.
 * @property content содержимое.
 */
internal data class ComponentPackageFile(
    val fileName: String,
    val content: String,
)

/**
 * План записи пакета в рабочую копию.
 *
 * План строится целиком до первой записи: частично записанный пакет хуже отказа, потому что
 * `meta.json` перестаёт описывать состав директории.
 *
 * @property configFiles файлы конфигураций.
 * @property meta файл `meta.json`.
 * @property unrelatedFiles файлы конфигураций, найденные в директории, но не входящие в пакет.
 *   Не удаляются: директория принадлежит разработчику, а не выгрузке.
 */
internal data class ComponentPackageWritePlan(
    val configFiles: List<ComponentPackageFile>,
    val meta: ComponentPackageFile,
    val unrelatedFiles: List<String> = emptyList(),
)

/**
 * Результат построения плана.
 */
internal sealed interface ComponentPackageWritePlanResult {
    /**
     * План построен.
     *
     * @property value план записи.
     */
    data class Built(
        val value: ComponentPackageWritePlan,
    ) : ComponentPackageWritePlanResult

    /**
     * План не построен. Частичный результат не возвращается.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ComponentPackageWritePlanResult
}
