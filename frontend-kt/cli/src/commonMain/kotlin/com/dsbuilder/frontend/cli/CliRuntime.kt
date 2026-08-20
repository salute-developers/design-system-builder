package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory

/**
 * Runtime-зависимости CLI, отделенные от command parsing для тестирования.
 *
 * @property fileSystem доступ к файловой системе.
 * @property environmentReader доступ к env-переменным.
 * @property httpClientFactory factory для authenticated project-scoped HTTP client.
 */
public data class CliRuntime(
    public val fileSystem: CliFileSystem,
    public val environmentReader: EnvironmentReader,
    public val httpClientFactory: AuthenticatedHttpClientFactory,
)

/**
 * Создает runtime-зависимости для текущей платформы.
 */
public expect fun defaultCliRuntime(): CliRuntime
