package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform
import kotlin.jvm.JvmInline

/**
 * Идентификатор платформенного toolchain'а: семейство инструментов, обслуживающее одну или
 * несколько целевых платформ (`ios` → SwiftUI и UIKit, `android` → Compose и View).
 *
 * @property value идентификатор в нижнем регистре: буквы, цифры и дефис.
 */
@JvmInline
public value class ToolchainId(
    public val value: String,
) {
    init {
        require(TOOLCHAIN_ID_PATTERN.matches(value)) {
            "Toolchain id must match [a-z][a-z0-9-]*, got '$value'."
        }
    }

    override fun toString(): String = value

    private companion object {
        val TOOLCHAIN_ID_PATTERN: Regex = Regex("[a-z][a-z0-9-]*")
    }
}

/**
 * Что клиент просит сделать платформенный инструмент.
 */
public enum class Capability(
    /** Название операции в сообщениях пользователю. */
    public val label: String,
) {
    /** Сгенерировать код темы: токены и info-артефакты темы. */
    THEME("theme generation"),

    /** Сгенерировать код компонентов: вариации, стили и info-артефакты компонентов. */
    COMPONENTS("components generation"),

    /** Собрать платформенно насыщенное дерево документации в `.sdds/temp/docs`. */
    DOCS_AGGREGATE("documentation aggregation"),
}

/**
 * Пути рабочей копии, которые получает платформенный инструмент.
 *
 * @property sddsDir абсолютный путь директории `.sdds` проекта.
 * @property workspaceDir абсолютный путь директории, содержащей `.sdds`; по соглашению — родитель `.sdds`.
 */
public data class WorkspacePaths(
    public val sddsDir: String,
    public val workspaceDir: String,
) {
    init {
        require(sddsDir.startsWith("/")) { "sddsDir must be an absolute path: '$sddsDir'." }
        require(workspaceDir.startsWith("/")) { "workspaceDir must be an absolute path: '$workspaceDir'." }
    }

    public companion object {
        /**
         * Строит пути рабочей копии по директории `.sdds`: workspace — её родитель.
         *
         * @param sddsDir абсолютный путь `.sdds`, не корень файловой системы.
         */
        public fun fromSddsDirectory(sddsDir: String): WorkspacePaths {
            val normalized = sddsDir.trimEnd('/')
            require(normalized.startsWith("/") && normalized.length > 1) {
                "sddsDir must be an absolute path below the file system root: '$sddsDir'."
            }
            val parent = normalized.substringBeforeLast('/').ifEmpty { "/" }

            return WorkspacePaths(sddsDir = normalized, workspaceDir = parent)
        }

        /**
         * Строит пути рабочей копии по найденному `.sdds/config.json`.
         *
         * @param configPath абсолютный путь config-файла.
         */
        public fun fromConfigPath(configPath: String): WorkspacePaths {
            val normalized = configPath.trimEnd('/')
            require(normalized.startsWith("/") && normalized.length > 1) {
                "configPath must be an absolute path below the file system root: '$configPath'."
            }

            return fromSddsDirectory(normalized.substringBeforeLast('/').ifEmpty { "/" })
        }
    }
}

/**
 * Вызов платформенного инструмента.
 *
 * @property capability что нужно сделать.
 * @property platform целевая платформа; делегат обязан её поддерживать (см. [PlatformDelegate.platforms]).
 * @property workspace пути рабочей копии.
 * @property output абсолютный путь выходной директории, если пользователь задал `--output`; иначе умолчание инструмента.
 * @property passthrough аргументы после `--`, которые инструмент получает без изменений.
 * @property toolOverride абсолютный путь инструмента из `--tool`, если пользователь задал его явно.
 */
public data class DelegateInvocation(
    public val capability: Capability,
    public val platform: TargetPlatform,
    public val workspace: WorkspacePaths,
    public val output: String? = null,
    public val passthrough: List<String> = emptyList(),
    public val toolOverride: String? = null,
) {
    init {
        require(output == null || output.startsWith("/")) { "output must be an absolute path: '$output'." }
        require(toolOverride == null || toolOverride.startsWith("/")) {
            "toolOverride must be an absolute path: '$toolOverride'."
        }
    }
}

/**
 * Результат вызова платформенного инструмента.
 */
public sealed interface DelegateResult {
    /**
     * Инструмент завершился успешно.
     *
     * @property summary краткий итог для пользователя: что и куда сгенерировано.
     */
    public data class Completed(
        public val summary: String,
    ) : DelegateResult

    /**
     * Инструмент запустился, но завершился с ошибкой.
     *
     * @property exitCode код завершения инструмента.
     * @property message user-facing объяснение.
     */
    public data class Failed(
        public val exitCode: Int,
        public val message: String,
    ) : DelegateResult

    /**
     * Инструмент не найден или не запускается.
     *
     * @property hint что сделать пользователю, например `dsbuilder toolchain install ios`.
     */
    public data class ToolchainMissing(
        public val hint: String,
    ) : DelegateResult

    /**
     * Делегат не умеет запрошенную capability для этой платформы.
     *
     * @property message user-facing объяснение.
     */
    public data class Unsupported(
        public val message: String,
    ) : DelegateResult
}

/**
 * Состояние платформенного toolchain'а, которое сообщает `doctor`.
 */
public sealed interface ToolchainStatus {
    /**
     * Инструмент найден и совместим.
     *
     * @property executable абсолютный путь найденного инструмента.
     * @property version версия, которую инструмент сообщил.
     */
    public data class Ready(
        public val executable: String,
        public val version: String,
    ) : ToolchainStatus

    /**
     * Инструмент не найден.
     *
     * @property hint что сделать пользователю, с перечнем проверенных мест.
     */
    public data class Missing(
        public val hint: String,
    ) : ToolchainStatus

    /**
     * Инструмент найден, но его версия не подходит.
     *
     * @property found найденная версия.
     * @property required минимально требуемая версия.
     */
    public data class Incompatible(
        public val found: String,
        public val required: String,
    ) : ToolchainStatus
}
