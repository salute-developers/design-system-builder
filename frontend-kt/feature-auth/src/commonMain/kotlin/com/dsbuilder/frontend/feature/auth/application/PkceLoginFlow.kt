package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.core.network.allowsInteractiveAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/** Проверенный authorization code, привязанный к исходной попытке входа. */
public data class VerifiedAuthorizationCode(
    /** Проверенный authorization code. */
    public val code: String,
    /** Исходный секрет PKCE. */
    public val verifier: String,
    /** Исходный redirect URI. */
    public val redirectUri: String,
)

/** Общий PKCE-сценарий; потребитель предоставляет обмен и собственное хранилище сессии. */
public class PkceLoginFlow(private val platform: PkcePlatform) {
    /** Проверяет браузерный ответ до передачи кода потребителю. */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun <T> execute(
        apiUrl: String,
        clientId: String,
        accept: suspend (VerifiedAuthorizationCode) -> AuthResult<T>,
    ): AuthResult<T> {
        if (!allowsInteractiveAuth(apiUrl)) {
            return AuthResult.Failed(
                AuthErrorCode.INVALID_AUTH_URL,
                "Авторизация требует HTTPS, кроме localhost и 127.0.0.1.",
            )
        }
        return try {
            withTimeout(180_000L) {
                val challenge = platform.generate()
                val listener = platform.listen()
                var successful = false
                try {
                    val redirect = "http://127.0.0.1:${listener.port}/callback"
                    val query = buildOAuthQuery(
                        linkedMapOf(
                            "client_id" to clientId,
                            "response_type" to "code",
                            "redirect_uri" to redirect,
                            "scope" to "openid profile",
                            "code_challenge" to challenge.challenge,
                            "code_challenge_method" to "S256",
                            "state" to challenge.state,
                        ),
                    )
                    platform.openBrowser("${apiUrl.trimEnd('/')}/realms/dsbuilder/protocol/openid-connect/auth?$query")
                    val callback = listener.awaitCallback()
                    val code = callback.parameters["code"]?.singleOrNull()
                    val sourceVerified = callback.path == "/callback" &&
                        callback.parameters["state"]?.singleOrNull() == challenge.state &&
                        !callback.parameters.containsKey("error")
                    val codeValid = !code.isNullOrBlank() && code.none { it.isWhitespace() || it.isISOControl() }
                    if (!sourceVerified || !codeValid) {
                        return@withTimeout AuthResult.Failed(
                            AuthErrorCode.AUTH_REQUIRED,
                            "Ответ авторизации не прошёл проверку.",
                        )
                    }
                    accept(VerifiedAuthorizationCode(requireNotNull(code), challenge.verifier, redirect)).also {
                        successful = it is AuthResult.Success
                    }
                } finally {
                    listener.completeAndClose(successful)
                }
            }
        } catch (exception: TimeoutCancellationException) {
            AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Время ожидания входа истекло (180 секунд).")
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            AuthResult.Failed(
                AuthErrorCode.BACKEND_UNAVAILABLE,
                "Не удалось выполнить браузерный вход; проверьте доступность браузера и Gateway.",
            )
        }
    }
}

private suspend fun OAuthCallbackListener.completeAndClose(success: Boolean) {
    withContext(NonCancellable) {
        try {
            runCatching { withTimeout(1_000L) { complete(success) } }
        } finally {
            close()
        }
    }
}
