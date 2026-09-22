package com.dsbuilder.frontend.feature.components.domain

import com.dsbuilder.frontend.feature.components.domain.codec.NativeConfig
import kotlinx.serialization.json.Json

private const val CONFIG_SUFFIX = "_config.json"
private const val META_FILE_NAME = "meta.json"

/**
 * Строит план записи выгруженного пакета в рабочую копию.
 *
 * Вся политика записи собрана здесь: имя файла, переиспользование имён, обнаружение коллизии,
 * порядок записей и вычисление несвязанных файлов. Реализация записи решений не принимает —
 * она исполняет готовый план.
 *
 * К файловой системе построитель не обращается: состояние директории он получает
 * [ExistingComponentPackage] и возвращает либо план, либо отказ с deterministic сообщением.
 */
internal class ComponentPackageWritePlanBuilder(
    private val json: Json = defaultJson,
) {
    fun build(
        name: String,
        version: String,
        configurations: List<RenderedComponentConfig>,
        existing: ExistingComponentPackage = ExistingComponentPackage(),
    ): ComponentPackageWritePlanResult {
        // Порядок детерминирован: повторная выгрузка не должна давать дифф на пустом месте.
        val ordered = configurations.sortedWith(
            compareBy({ it.componentName }, { it.styleName }),
        )

        val reusable = existing.entries.associate { (it.componentName to it.styleName) to it.config }
        val fileNames = resolveFileNames(ordered, reusable)

        duplicateOf(fileNames)?.let { duplicate ->
            val pairs = ordered
                .filterIndexed { index, _ -> fileNames[index] == duplicate }
                .joinToString(separator = ", ") { "${it.componentName}/${it.styleName}" }
            return ComponentPackageWritePlanResult.Failed(
                "Error: File name `$duplicate` is claimed by more than one configuration: $pairs.",
            )
        }

        val entries = ordered.mapIndexed { index, configuration ->
            ComponentPackageMetaEntry(
                componentName = configuration.componentName,
                styleName = configuration.styleName,
                config = fileNames[index],
            )
        }

        val configFiles = ordered.mapIndexed { index, configuration ->
            ComponentPackageFile(
                fileName = fileNames[index],
                // Перевод строки в конце: так заканчиваются все 144 файла исходного пакета,
                // и без него diff помечает изменённым каждый файл выгрузки. `meta.json`
                // завершается без него — там формат тот же, что и был.
                content = json.encodeToString(NativeConfig.serializer(), configuration.config) + "\n",
            )
        }

        // Файл, оставшийся от прежнего состава, не удаляется: директория принадлежит
        // разработчику. Он предъявляется, чтобы удаление было его решением.
        val written = fileNames.toSet()
        val unrelated = existing.fileNames
            .filter { it != META_FILE_NAME && it !in written }
            .sorted()

        return ComponentPackageWritePlanResult.Built(
            ComponentPackageWritePlan(
                configFiles = configFiles,
                meta = ComponentPackageFile(
                    fileName = META_FILE_NAME,
                    content = json.encodeToString(
                        ComponentPackageMeta.serializer(),
                        ComponentPackageMeta(name = name, version = version, components = entries),
                    ),
                ),
                unrelatedFiles = unrelated,
            ),
        )
    }

    /**
     * Правило имени файла для пары, которой не было в существующем пакете.
     *
     * Короткое имя строится из `styleName`. Если оно совпало у нескольких компонентов,
     * [resolveFileNames] добавляет `componentName`. Разделители приводятся к `_`.
     */
    private fun fileNameOf(styleName: String): String =
        fileStemOf(styleName) + CONFIG_SUFFIX

    /**
     * Сохраняет имена существующего пакета и уточняет новые коллизии полной парой идентичности.
     */
    private fun resolveFileNames(
        configurations: List<RenderedComponentConfig>,
        reusable: Map<Pair<String, String>, String>,
    ): List<String> {
        val reused = configurations.map { reusable[it.componentName to it.styleName] }
        val resolved = configurations.mapIndexed { index, configuration ->
            // Имя файла — факт рабочей копии, а не дизайн-системы, и правилом выводится
            // не полностью: существующий пакет остаётся авторитетным для известной пары.
            reused[index] ?: fileNameOf(configuration.styleName)
        }.toMutableList()

        // Appearance уникален только внутри компонента: несколько компонентов законно имеют
        // styleName `default`. Уточняются только новые имена; унаследованные не переименовываются.
        resolved.withIndex()
            .groupBy({ it.value }, { it.index })
            .values
            .filter { it.size > 1 }
            .flatten()
            .filter { reused[it] == null }
            .forEach { index ->
                val configuration = configurations[index]
                resolved[index] = fileNameOf(configuration.componentName, configuration.styleName)
            }
        return resolved
    }

    /** Разрешает коллизию styleName именем, построенным из полной пары идентичности. */
    private fun fileNameOf(componentName: String, styleName: String): String =
        "${fileStemOf(componentName)}_${fileStemOf(styleName)}$CONFIG_SUFFIX"

    private fun fileStemOf(value: String): String =
        value.map { character -> if (character == '-' || character == '.') '_' else character }
            .joinToString(separator = "")

    private fun duplicateOf(fileNames: List<String>): String? =
        fileNames.groupBy { it }.entries.firstOrNull { it.value.size > 1 }?.key

    private companion object {
        val defaultJson: Json = Json {
            prettyPrint = true
            encodeDefaults = false
            explicitNulls = false
        }
    }
}
