package com.dsbuilder.frontend.feature.ds.application

import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.UserSessionAccess
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/** Краткое описание системы выбранного проекта.
 * @property id идентификатор системы.
 * @property name имя системы.
 * @property description необязательное описание.
 */
public data class DesignSystemSummary(public val id: String, public val name: String, public val description: String?)

/** Категория отказа каталога. */
public enum class DesignSystemsReadErrorCode {
    /** Нет действующей пользовательской сессии. */
    AUTH_REQUIRED,

    /** Пользователь не имеет доступа. */
    FORBIDDEN,

    /** Проект отсутствует. */
    NOT_FOUND,

    /** Backend или транспорт недоступен. */
    BACKEND_UNAVAILABLE,

    /** Ответ не соответствует контракту. */
    INVALID_BACKEND_RESPONSE,

    /** Параметры запроса некорректны. */
    INVALID_QUERY,
}

/** Результат чтения каталога без локального контекста. */
public sealed interface DesignSystemsReadResult {
    /** Успешный, возможно пустой список.
     * @property items системы выбранного проекта.
     */
    public data class Success(public val items: List<DesignSystemSummary>) : DesignSystemsReadResult

    /** Безопасный отказ.
     * @property code категория отказа.
     * @property message пояснение без credentials.
     */
    public data class Failed(
        public val code: DesignSystemsReadErrorCode,
        public val message: String,
    ) : DesignSystemsReadResult
}

/** Порт каталога; публичен для composition root IDE без Koin. */
public fun interface DesignSystemsClient {
    /** Получает системы проекта с явно выбранной авторизацией. */
    public suspend fun list(apiUrl: String, credential: BackendCredential, projectId: String): DesignSystemsReadResult
}

/** Получает системы проекта только от имени пользователя, не читая workspace. */
public class ListDesignSystemsUseCase(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionAccess,
    private val client: DesignSystemsClient,
) {
    /** Возвращает системы projectId либо безопасную ошибку. */
    public suspend fun execute(projectId: String, apiUrlOverride: String? = null): DesignSystemsReadResult {
        if (projectId.isBlank()) {
            return DesignSystemsReadResult.Failed(
                DesignSystemsReadErrorCode.INVALID_QUERY,
                "projectId is required.",
            )
        }
        val apiUrl = apiUrlResolver.resolve(apiUrlOverride).value
        return when (val access = sessionResolver.resolve(apiUrl)) {
            is CredentialResult.Selected -> client.list(apiUrl, access.credential, projectId)
            is CredentialResult.Failed -> DesignSystemsReadResult.Failed(
                SYSTEM_SESSION_FAILURES[access.code] ?: DesignSystemsReadErrorCode.BACKEND_UNAVAILABLE,
                if (access.code == AuthErrorCode.AUTH_REQUIRED) {
                    "Cannot authorize discovery. Run dsbuilder auth login and retry."
                } else {
                    "Cannot authorize discovery: ${access.code}."
                },
            )
        }
    }
}

private val SYSTEM_SESSION_FAILURES = mapOf(
    AuthErrorCode.AUTH_REQUIRED to DesignSystemsReadErrorCode.AUTH_REQUIRED,
    AuthErrorCode.FORBIDDEN to DesignSystemsReadErrorCode.FORBIDDEN,
)
