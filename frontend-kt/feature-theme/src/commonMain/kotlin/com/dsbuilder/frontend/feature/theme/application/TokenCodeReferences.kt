package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/** Результат получения code-ссылки на токен. */
public sealed interface TokenCodeReferenceResult {
    /**
     * Ссылка найдена.
     *
     * @property reference код токена в теме, например `SddsServTheme.colors.textDefaultAccent`.
     */
    public data class Found(public val reference: String) : TokenCodeReferenceResult

    /** Ссылки нет: дизайн-система не опубликована для платформы, токена нет в публикации или у типа нет accessor'а. */
    public data object NotAvailable : TokenCodeReferenceResult

    /**
     * Запрос завершился ошибкой.
     *
     * @property code stable machine-readable категория.
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val code: TokenCodeReferenceErrorCode,
        public val message: String,
    ) : TokenCodeReferenceResult
}

/** Stable error category получения code-ссылки. */
public enum class TokenCodeReferenceErrorCode {
    /** Пользовательская сессия отсутствует или невалидна. */
    AUTH_REQUIRED,

    /** Backend недоступен или вернул неожиданный ответ. */
    BACKEND_UNAVAILABLE,
}

/**
 * Port чтения code-ссылки токена из CodeBinding опубликованной документации. `public` — non-Koin клиент
 * (плагин) собирает use case напрямую.
 */
public fun interface TokenCodeReferenceClient {
    /**
     * Ищет `themeReference` токена в последней публикации дизайн-системы для [platform]: перебирает
     * [subjects] по порядку (`tokens.<mode>.<имя>`, затем `tokens.<имя>`) и возвращает первую найденную.
     */
    public suspend fun themeReference(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
        platform: String,
        subjects: List<String>,
    ): TokenCodeReferenceResult
}

/**
 * Возвращает code-ссылку на токен из CodeBinding (`kind=token`) опубликованной документации. Ссылка
 * приходит готовой от генератора темы (`themeReference`) — локальный alias или `.sdds/config.json`
 * не нужны. Вызывается по требованию, для одного токена. Не требует `ProjectContext`.
 */
public class GetTokenCodeReferenceUseCase(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionCredentialResolver,
    private val client: TokenCodeReferenceClient,
) {
    /**
     * Выполняет сценарий.
     *
     * @param tokenName имя токена без режима (`text.default.accent`).
     * @param mode `light`/`dark` для токенов, зависящих от темы; для остальных не влияет на результат.
     * @param platform платформа публикации (`compose`).
     */
    public suspend fun execute(
        projectId: String,
        designSystemId: String,
        tokenName: String,
        mode: String?,
        platform: String = DEFAULT_PLATFORM,
        apiUrlOverride: String? = null,
    ): TokenCodeReferenceResult {
        val accessToken = sessionResolver.currentAccessToken()
            ?: return TokenCodeReferenceResult.Failed(
                TokenCodeReferenceErrorCode.AUTH_REQUIRED,
                "Error: user session is not configured.",
            )
        val subjects = listOfNotNull(mode?.let { "tokens.$it.$tokenName" }, "tokens.$tokenName")
        return client.themeReference(
            apiUrlResolver.resolve(apiUrlOverride).value,
            BackendCredential.Bearer(accessToken),
            projectId,
            designSystemId,
            platform,
            subjects,
        )
    }

    private companion object {
        const val DEFAULT_PLATFORM = "compose"
    }
}
