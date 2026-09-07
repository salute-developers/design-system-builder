package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/**
 * Runtime-зависимости клиента DS Builder, отделенные от command parsing для тестирования.
 *
 * Композицию конкретных реализаций для платформы (JVM, macOS) собирает composition root
 * запускающего приложения — `:cli` или будущие `:mcp`/`:desktop`, — а не этот модуль.
 *
 * @property fileSystem доступ к файловой системе.
 * @property environmentReader доступ к env-переменным.
 * @property httpClientFactory factory для authenticated project-scoped HTTP client.
 * @property processRunner запуск внешних процессов — платформенных инструментов дизайн-системы.
 */
public data class ClientRuntime(
    public val fileSystem: WorkspaceFileSystem,
    public val environmentReader: EnvironmentReader,
    public val httpClientFactory: AuthenticatedHttpClientFactory,
    public val processRunner: ProcessRunner,
)
