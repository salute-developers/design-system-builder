package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.feature.components.application.ComponentDirectoryReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.feature.components.application.LocalComponentPackageWriter
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlan
import com.dsbuilder.frontend.feature.components.domain.ExistingComponentPackage
import kotlinx.serialization.json.Json

private const val CONFIG_SUFFIX = "_config.json"

/**
 * Читает состояние целевой директории перед записью пакета.
 *
 * Читается ровно то, что нужно построителю плана: имена файлов из `meta.json`, которые правилом
 * не выводятся, и перечень файлов на диске для вычисления несвязанных. Ни отсутствие директории,
 * ни отсутствие `meta.json` отказом не является: в пустую директорию пакет пишется целиком.
 */
internal class LocalComponentPackageDirectoryReader(
    private val fileSystem: WorkspaceFileSystem,
) : ComponentPackageDirectoryReader {
    private val json = Json { ignoreUnknownKeys = true }

    override fun read(
        destination: ComponentDestination,
        context: ProjectContext,
    ): ComponentDirectoryReadResult {
        val directory = destination.directory ?: defaultDirectory(fileSystem, context)
        if (!fileSystem.exists(directory)) {
            return ComponentDirectoryReadResult.Read(ExistingComponentPackage(), directory)
        }

        val metaPath = fileSystem.resolve(directory, META_FILE)
        val meta = if (fileSystem.exists(metaPath)) {
            try {
                json.decodeFromString(
                    com.dsbuilder.frontend.feature.components.domain.ComponentPackageMeta.serializer(),
                    fileSystem.readText(metaPath),
                )
            } catch (exception: IllegalArgumentException) {
                // Нечитаемый `meta.json` — отказ, а не пустое состояние: иначе выгрузка молча
                // переименовала бы все файлы пакета, потеряв уже выбранные имена.
                return ComponentDirectoryReadResult.Failed(
                    "Error: $META_FILE of '$directory' cannot be parsed: " +
                        "${exception.message ?: "unexpected shape"}.",
                )
            }
        } else {
            null
        }

        val fileNames = fileSystem.listFiles(directory)
            .map { path -> path.substringAfterLast('/') }
            .filter { it.endsWith(CONFIG_SUFFIX) || it == META_FILE }
            .sorted()

        return ComponentDirectoryReadResult.Read(
            ExistingComponentPackage(entries = meta?.components.orEmpty(), fileNames = fileNames),
            directory,
        )
    }
}

/**
 * Записывает файлы плана в целевую директорию.
 *
 * Решений о составе и именах не принимает: они приняты построителем плана в `domain`. Здесь
 * остаётся только исполнение — создать директорию, если её нет, и записать файлы на место.
 */
internal class LocalComponentPackageFileWriter(
    private val fileSystem: WorkspaceFileSystem,
) : LocalComponentPackageWriter {
    override fun write(
        plan: ComponentPackageWritePlan,
        destination: ComponentDestination,
        context: ProjectContext,
    ): ComponentPackageWriteResult {
        val directory = destination.directory ?: defaultDirectory(fileSystem, context)

        return try {
            fileSystem.createDirectories(directory)
            // `meta.json` пишется последним: он описывает состав директории, и до записи
            // всех конфигураций такое описание было бы неверным.
            plan.configFiles.forEach { file ->
                fileSystem.writeText(fileSystem.resolve(directory, file.fileName), file.content)
            }
            fileSystem.writeText(fileSystem.resolve(directory, plan.meta.fileName), plan.meta.content)

            ComponentPackageWriteResult.Written(directory)
        } catch (exception: IllegalStateException) {
            ComponentPackageWriteResult.Failed(
                "Error: cannot write component package into '$directory': " +
                    "${exception.message ?: "unexpected failure"}.",
            )
        }
    }
}

/**
 * Директория пакета по умолчанию: `components` рядом с project config.
 */
private fun defaultDirectory(fileSystem: WorkspaceFileSystem, context: ProjectContext): String {
    val configDirectory = fileSystem.parent(context.configPath) ?: context.configPath
    return fileSystem.resolve(configDirectory, COMPONENTS_DIRECTORY)
}
