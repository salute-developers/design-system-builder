package com.dsbuilder.frontend.core.process

/**
 * Порт запуска внешнего процесса.
 *
 * Единственная точка, через которую клиент DS Builder запускает платформенные инструменты
 * (Swift CLI, Gradle и другие). Presentation и use case'ы процессы не запускают: адаптер
 * платформы собирает [ProcessRequest] и получает [ProcessResult] обратно.
 */
public fun interface ProcessRunner {
    /**
     * Запускает процесс и ждёт его завершения.
     *
     * @param request что и как запустить.
     * @return exit code и захваченный вывод.
     * @throws ProcessLaunchException если процесс не удалось запустить (нет файла, нет прав).
     */
    public fun run(request: ProcessRequest): ProcessResult
}

/**
 * Запрос на запуск внешнего процесса.
 *
 * @property executable абсолютный путь к исполняемому файлу; поиск по `PATH` — обязанность вызывающего.
 * @property args аргументы без имени исполняемого файла, передаются как есть, без shell.
 * @property workingDirectory абсолютный путь рабочей директории процесса.
 * @property environment переменные, которые ДОБАВЛЯЮТСЯ к окружению родителя; совпадающие имена перекрываются.
 * @property inheritStdio `true` — процесс пишет прямо в терминал клиента (для длинных сборок);
 * `false` — stdout и stderr захватываются в [ProcessResult.output].
 */
public data class ProcessRequest(
    public val executable: String,
    public val args: List<String>,
    public val workingDirectory: String,
    public val environment: Map<String, String> = emptyMap(),
    public val inheritStdio: Boolean = true,
) {
    init {
        require(executable.startsWith("/")) { "Process executable must be an absolute path: '$executable'." }
        require(workingDirectory.startsWith("/")) {
            "Process working directory must be an absolute path: '$workingDirectory'."
        }
        require(environment.keys.none { it.isBlank() }) { "Process environment keys must not be blank." }
    }

    /** Полная командная строка: исполняемый файл и аргументы. */
    public val commandLine: List<String>
        get() = listOf(executable) + args
}

/**
 * Результат завершившегося процесса.
 *
 * @property exitCode код завершения; процесс, убитый сигналом, отражается как `128 + номер сигнала`.
 * @property output объединённые stdout и stderr при `inheritStdio = false`; пустая строка, если вывод наследовался.
 */
public data class ProcessResult(
    public val exitCode: Int,
    public val output: String,
)

/**
 * Процесс не удалось запустить: исполняемый файл отсутствует, нет прав или рабочая директория недоступна.
 */
public class ProcessLaunchException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
