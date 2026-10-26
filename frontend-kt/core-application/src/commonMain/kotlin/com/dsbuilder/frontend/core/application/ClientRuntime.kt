package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UnavailablePkcePlatform
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
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
 * @property credentialStore persistent user-session storage.
 * @property tokenClient backend token lifecycle client.
 * @property close releases runtime-owned resources.
 * @property pkcePlatform платформенные порты интерактивного входа.
 * @property accessTokenCache кеш пользовательских токенов процесса.
 */
public data class ClientRuntime(
    public val fileSystem: WorkspaceFileSystem,
    public val environmentReader: EnvironmentReader,
    public val httpClientFactory: AuthenticatedHttpClientFactory,
    public val processRunner: ProcessRunner = UnavailableProcessRunner,
    public val credentialStore: CredentialStore = EmptyCredentialStore,
    public val tokenClient: TokenClient = UnavailableTokenClient,
    public val close: () -> Unit = {},
    public val accessTokenCache: com.dsbuilder.frontend.core.auth.UserAccessTokenCache =
        com.dsbuilder.frontend.core.auth.UserAccessTokenCache(),
    public val pkcePlatform: PkcePlatform =
        UnavailablePkcePlatform,
)

private object UnavailableProcessRunner : ProcessRunner {
    override fun run(request: ProcessRequest) =
        throw ProcessLaunchException(
            "External process execution is not configured for this client runtime.",
        )
}

private object EmptyCredentialStore : CredentialStore {
    override suspend fun read(apiUrl: String) = null

    override suspend fun save(session: UserSession) = Unit

    override suspend fun delete(apiUrl: String) = Unit
}

private object UnavailableTokenClient : TokenClient {
    override suspend fun exchangeCode(
        apiUrl: String,
        code: String,
        verifier: String,
        redirectUri: String,
    ): AuthResult<TokenResponse> =
        AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: user session is not configured.")

    override suspend fun refresh(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<TokenResponse> =
        AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: user session is not configured.")

    override suspend fun logout(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<Unit> =
        AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: user session is not configured.")
}
