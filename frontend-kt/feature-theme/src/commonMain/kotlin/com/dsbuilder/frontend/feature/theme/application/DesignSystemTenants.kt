package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/**
 * Tenant дизайн-системы — независимо настраиваемый срез токенов.
 *
 * @property id идентификатор tenant.
 * @property name имя tenant.
 * @property description описание, если задано.
 */
public data class DesignSystemTenant(
    public val id: String,
    public val name: String,
    public val description: String?,
)

/** Stable error category получения tenant. */
public enum class DesignSystemTenantsErrorCode {
    /** Пользовательская сессия отсутствует или невалидна. */
    AUTH_REQUIRED,

    /** Backend недоступен или вернул неожиданный ответ. */
    BACKEND_UNAVAILABLE,
}

/** Результат получения tenant дизайн-системы. */
public sealed interface DesignSystemTenantsResult {
    /**
     * Tenant получены (список может быть пустым).
     *
     * @property tenants tenant выбранной дизайн-системы.
     */
    public data class Success(public val tenants: List<DesignSystemTenant>) : DesignSystemTenantsResult

    /**
     * Получение завершилось ошибкой.
     *
     * @property code stable machine-readable категория.
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val code: DesignSystemTenantsErrorCode,
        public val message: String,
    ) : DesignSystemTenantsResult
}

/** Port чтения tenant дизайн-системы. `public` — non-Koin клиент (плагин) собирает use case напрямую. */
public fun interface DesignSystemTenantsClient {
    /** `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tenants`. */
    public suspend fun listTenants(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
    ): DesignSystemTenantsResult
}

/**
 * Возвращает tenant выбранной дизайн-системы от имени пользовательской сессии. Не требует
 * `ProjectContext`: проект и дизайн-система выбираются интерактивно.
 */
public class ListDesignSystemTenantsUseCase(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionCredentialResolver,
    private val client: DesignSystemTenantsClient,
) {
    /** Выполняет сценарий. */
    public suspend fun execute(
        projectId: String,
        designSystemId: String,
        apiUrlOverride: String? = null,
    ): DesignSystemTenantsResult {
        val accessToken = sessionResolver.currentAccessToken()
            ?: return DesignSystemTenantsResult.Failed(
                DesignSystemTenantsErrorCode.AUTH_REQUIRED,
                "Error: user session is not configured.",
            )
        return client.listTenants(
            apiUrlResolver.resolve(apiUrlOverride).value,
            BackendCredential.Bearer(accessToken),
            projectId,
            designSystemId,
        )
    }
}
