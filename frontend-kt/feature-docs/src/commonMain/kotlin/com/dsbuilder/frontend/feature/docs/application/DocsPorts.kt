package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.ProjectContextFailure
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.docs.domain.DocumentationPlatformContext
import com.dsbuilder.frontend.feature.docs.domain.Manifest
import com.dsbuilder.frontend.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.feature.docs.domain.Structure

/**
 * Порт для чтения structure-файлов от агрегатора.
 */
internal interface DocsStructureReader {
    /**
     * Парсит [Structure] из JSON-файла по пути.
     *
     * @param path абсолютный путь к файлу.
     * @return распарсенная структура.
     */
    fun readStructure(path: String): Structure
}

/** Порт опционального чтения `meta/platform-context.json` от платформенного агрегатора. */
internal fun interface DocsPlatformContextReader {
    /** Читает и проверяет platform context либо возвращает `null`, если файл отсутствует. */
    fun read(path: String): DocumentationPlatformContext?
}

/**
 * Порт для разрешения идентификаторов дизайн-системы.
 */
internal interface DocsProjectContextReader {
    /**
     * Возвращает идентификатор дизайн-системы из локального конфига.
     */
    fun designSystemId(): String

    /**
     * Возвращает fallback-версию дизайн-системы, если платформенный агрегатор её не предоставил.
     */
    fun designSystemVersion(): String

    /**
     * Возвращает целевые платформы проекта из локального config.
     */
    fun platforms(): DocsPlatformsRead = DocsPlatformsRead.NotInitialized
}

/**
 * Результат чтения целевых платформ проекта.
 *
 * Отсутствие проекта и неверный config — разные вещи: без проекта команда работает по
 * историческому умолчанию, а вот подменять умолчанием сломанный config нельзя, иначе опечатка
 * в нём даёт молча собранный пакет с чужой платформой.
 */
internal sealed interface DocsPlatformsRead {
    /**
     * Config прочитан.
     *
     * @property platforms объявленные платформы; пустой список означает, что их не объявили.
     */
    data class Configured(
        val platforms: List<TargetPlatform>,
    ) : DocsPlatformsRead

    /** `.sdds/config.json` не найден. */
    data object NotInitialized : DocsPlatformsRead

    /**
     * Config найден, но не читается или содержит неизвестные значения.
     *
     * @property message user-facing ошибка.
     */
    data class Invalid(
        val message: String,
    ) : DocsPlatformsRead
}

/**
 * Адаптер DocsProjectContextReader на основе ProjectContextReader.
 */
internal class DocsProjectContextAdapter(
    private val projectContextReader: ProjectContextReader,
) : DocsProjectContextReader {
    override fun platforms(): DocsPlatformsRead =
        when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found -> DocsPlatformsRead.Configured(result.context.platforms)
            is ProjectContextReadResult.Failed -> when (result.reason) {
                ProjectContextFailure.NOT_INITIALIZED -> DocsPlatformsRead.NotInitialized
                ProjectContextFailure.INVALID -> DocsPlatformsRead.Invalid(result.message)
            }
        }

    override fun designSystemId(): String {
        return when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found -> result.context.designSystemId.value
            is ProjectContextReadResult.Failed -> "unknown"
        }
    }

    override fun designSystemVersion(): String {
        // TODO: получать фактическую версию дизайн-системы из versioned project context.
        return "0.0.0"
    }
}

/**
 * Порт для сериализации JSON.
 */
internal interface DocsCodec {
    /**
     * Сериализует [ResolvedDocs] в JSON-строку.
     */
    fun serializeResolvedDocs(docs: ResolvedDocs): String

    /**
     * Сериализует [Manifest] в JSON-строку.
     */
    fun serializeManifest(manifest: Manifest): String
}

/**
 * Порт для работы с файловой системой при упаковке пакета.
 */
internal interface DocsFileSystem {
    /**
     * Записывает строку в файл.
     *
     * @param path абсолютный путь к файлу.
     * @param content содержимое.
     */
    fun writeFile(path: String, content: String)

    /**
     * Упаковывает директорию и всё её содержимое в tar.gz-архив.
     *
     * @param sourceDir абсолютный путь к исходной директории.
     * @param tarGzPath абсолютный путь к выходному tar.gz-файлу.
     */
    fun createTarGzArchive(sourceDir: String, tarGzPath: String)
}
