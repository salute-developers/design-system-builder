package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageResult
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlan
import com.dsbuilder.frontend.feature.components.domain.ExistingComponentPackage

/**
 * Откуда брать пакет конфигураций компонентов.
 *
 * @property directory директория, заданная `--from`, либо `null` для `.sdds/components`.
 */
public data class ComponentSource(
    public val directory: String? = null,
)

/**
 * Port чтения пакета конфигураций компонентов.
 */
internal fun interface ComponentPackageLoader {
    /**
     * Читает пакет из указанной директории.
     */
    fun load(
        source: ComponentSource,
        context: ProjectContext,
    ): ComponentPackageResult
}

/**
 * Куда писать выгруженный пакет.
 *
 * @property directory директория, заданная `--to`, либо `null` для `.sdds/components`.
 */
public data class ComponentDestination(
    public val directory: String? = null,
)

/**
 * Port чтения состояния целевой директории.
 *
 * Отдельно от [ComponentPackageLoader], который читает пакет целиком и отказывает, если файл,
 * указанный в `meta.json`, отсутствует. Выгрузке нужен противоположный контракт: прочитать
 * имена из `meta.json`, каким бы неполным он ни был, и перечислить файлы на диске.
 * Переиспользование loader'а потребовало бы режима «читать частично», то есть двух контрактов
 * в одном порте.
 */
internal fun interface ComponentPackageDirectoryReader {
    /**
     * Читает состояние директории. Отсутствие директории и `meta.json` отказом не является.
     */
    fun read(
        destination: ComponentDestination,
        context: ProjectContext,
    ): ComponentDirectoryReadResult
}

/**
 * Результат чтения целевой директории.
 */
internal sealed interface ComponentDirectoryReadResult {
    /**
     * Директория прочитана.
     *
     * @property value состояние директории.
     * @property path путь директории для вывода команды.
     */
    data class Read(
        val value: ExistingComponentPackage,
        val path: String,
    ) : ComponentDirectoryReadResult

    /**
     * Директорию прочитать не удалось.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ComponentDirectoryReadResult
}

/**
 * Port записи пакета в рабочую копию.
 *
 * Реализация исполняет готовый план и решений о составе и именах не принимает: вся политика
 * записи живёт в `domain`, в построителе плана.
 */
internal fun interface LocalComponentPackageWriter {
    /**
     * Записывает файлы плана в целевую директорию, создавая её при отсутствии.
     */
    fun write(
        plan: ComponentPackageWritePlan,
        destination: ComponentDestination,
        context: ProjectContext,
    ): ComponentPackageWriteResult
}

/**
 * Результат записи пакета.
 */
internal sealed interface ComponentPackageWriteResult {
    /**
     * Пакет записан.
     *
     * @property path директория, в которую записан пакет.
     */
    data class Written(
        val path: String,
    ) : ComponentPackageWriteResult

    /**
     * Запись не выполнена.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ComponentPackageWriteResult
}
