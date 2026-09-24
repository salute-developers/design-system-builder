package com.dsbuilder.frontend.plugin.androidstudio

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenExchangeClient
import com.dsbuilder.frontend.feature.auth.application.OAuthLoginUseCase
import com.dsbuilder.frontend.feature.auth.application.OAuthLogoutUseCase
import com.dsbuilder.frontend.feature.auth.application.RefreshUserSessionUseCase
import com.dsbuilder.frontend.feature.auth.data.JvmRedirectListenerFactory
import com.dsbuilder.frontend.feature.projects.application.ListProjectsUseCase
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadErrorCode
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import com.dsbuilder.frontend.feature.projects.data.HttpProjectsClient
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsErrorCode
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsResult
import com.dsbuilder.frontend.feature.theme.application.GetTokenCodeReferenceUseCase
import com.dsbuilder.frontend.feature.theme.application.ListDesignSystemTenantsUseCase
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceErrorCode
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.feature.theme.data.HttpDesignSystemTenantsClient
import com.dsbuilder.frontend.feature.theme.data.HttpTokenCodeReferenceClient
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.auth.IdeBrowserLauncher
import com.dsbuilder.frontend.plugin.androidstudio.auth.PasswordSafeRefreshTokenStore
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GetDesignSystemTokensUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.HttpDesignSystemDataClient
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ListDesignSystemsUseCase
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO

private const val CLIENT_ID = "dsbuilder-studio-plugin"

/**
 * Композиционный корень плагина: связывает общие модули `core-*`/`feature-*` с платформенными
 * реализациями портов (браузер, `PasswordSafe`). Простой `object` — плагин не заводит
 * DI-фреймворк ради небольшого набора singleton-зависимостей; use case'ы `feature-projects`
 * и `feature-auth` поэтому конструируются здесь напрямую, а не через их Koin-модули.
 */
public object PluginServices {
    private val environmentReader = EnvironmentReader { name -> System.getenv(name) }
    private val apiUrlResolver by lazy { ApiUrlResolver(environmentReader) }
    private val apiUrl by lazy { apiUrlResolver.resolve(override = null).value }
    private val httpClient by lazy { HttpClient(CIO) }
    private val httpClientFactory by lazy { KtorAuthenticatedHttpClientFactory { httpClient } }
    private val tokenExchangeClient by lazy {
        KtorTokenExchangeClient(httpClient, tokenEndpointUrl = "${apiUrl.trimEnd('/')}/auth/token")
    }

    /** Держатель активной пользовательской OAuth-сессии — один на процесс плагина. */
    public val sessionResolver: UserSessionCredentialResolver by lazy {
        UserSessionCredentialResolver(PasswordSafeRefreshTokenStore())
    }

    /**
     * Тихое обновление сессии по сохранённому refresh token — используется и для retry на `401`
     * в [authenticatedApiClient], и для восстановления сессии при открытии tool window
     * (см. [com.dsbuilder.frontend.plugin.androidstudio.ui.PluginRootScreen]), чтобы не заставлять
     * пользователя логиниться заново в каждом новом процессе, если сессия ещё жива.
     */
    public val refreshUserSession: RefreshUserSessionUseCase by lazy {
        RefreshUserSessionUseCase(tokenExchangeClient, sessionResolver, CLIENT_ID)
    }

    private val authenticatedApiClient by lazy {
        AuthenticatedApiClient(httpClient, apiUrl, sessionResolver, refreshUserSession)
    }

    /** Use case интерактивного входа через Authorization Code + PKCE в системном браузере. */
    public val oauthLogin: OAuthLoginUseCase by lazy {
        OAuthLoginUseCase(
            clientId = CLIENT_ID,
            apiUrlResolver = apiUrlResolver,
            tokenExchangeClient = tokenExchangeClient,
            sessionResolver = sessionResolver,
            browserLauncher = IdeBrowserLauncher(),
            redirectListenerFactory = JvmRedirectListenerFactory(),
        )
    }

    /** Use case явного выхода — завершает SSO-сессию в браузере и локальную сессию плагина. */
    public val oauthLogout: OAuthLogoutUseCase by lazy {
        OAuthLogoutUseCase(
            clientId = CLIENT_ID,
            apiUrlResolver = apiUrlResolver,
            sessionResolver = sessionResolver,
            browserLauncher = IdeBrowserLauncher(),
            redirectListenerFactory = JvmRedirectListenerFactory(),
        )
    }

    private val listProjectsUseCase: ListProjectsUseCase by lazy {
        ListProjectsUseCase(apiUrlResolver, sessionResolver, HttpProjectsClient(httpClientFactory))
    }

    /**
     * Общий retry: use case'ы `feature-*` не делают повтор на `401` сами — при отказе один раз тихо
     * обновляем сессию и повторяем вызов (как [authenticatedApiClient] для локальных read-клиентов).
     */
    private suspend fun <T> retryOnceAfterRefresh(isAuthRequired: (T) -> Boolean, call: suspend () -> T): T {
        val result = call()
        return if (isAuthRequired(result) && refreshUserSession.execute()) call() else result
    }

    /** Список проектов пользователя для главного экрана. */
    public suspend fun listProjects(): ProjectsReadResult = retryOnceAfterRefresh(
        isAuthRequired = { it is ProjectsReadResult.Failed && it.code == ProjectsReadErrorCode.AUTH_REQUIRED },
        call = { listProjectsUseCase.execute() },
    )

    /** Use case списка дизайн-систем проекта. */
    public val listDesignSystems: ListDesignSystemsUseCase by lazy {
        ListDesignSystemsUseCase(HttpDesignSystemDataClient(authenticatedApiClient))
    }

    /** Use case получения токенов дизайн-системы со значениями для платформы и tenant. */
    public val getDesignSystemTokens: GetDesignSystemTokensUseCase by lazy {
        GetDesignSystemTokensUseCase(HttpDesignSystemDataClient(authenticatedApiClient))
    }

    private val listTenantsUseCase: ListDesignSystemTenantsUseCase by lazy {
        ListDesignSystemTenantsUseCase(
            apiUrlResolver,
            sessionResolver,
            HttpDesignSystemTenantsClient(httpClientFactory),
        )
    }

    /** Список tenant дизайн-системы. */
    public suspend fun listTenants(projectId: String, designSystemId: String): DesignSystemTenantsResult =
        retryOnceAfterRefresh(
            isAuthRequired = {
                it is DesignSystemTenantsResult.Failed && it.code == DesignSystemTenantsErrorCode.AUTH_REQUIRED
            },
            call = { listTenantsUseCase.execute(projectId, designSystemId) },
        )

    private val getTokenCodeReferenceUseCase: GetTokenCodeReferenceUseCase by lazy {
        GetTokenCodeReferenceUseCase(apiUrlResolver, sessionResolver, HttpTokenCodeReferenceClient(httpClientFactory))
    }

    /**
     * Code-ссылка на токен (`SddsServTheme.colors.textDefaultAccent`) из CodeBinding опубликованной
     * документации. Запрашивается по требованию, для одного токена; [mode] — `light`/`dark`.
     */
    public suspend fun tokenCodeReference(
        projectId: String,
        designSystemId: String,
        tokenName: String,
        mode: String,
    ): TokenCodeReferenceResult = retryOnceAfterRefresh(
        isAuthRequired = {
            it is TokenCodeReferenceResult.Failed && it.code == TokenCodeReferenceErrorCode.AUTH_REQUIRED
        },
        call = { getTokenCodeReferenceUseCase.execute(projectId, designSystemId, tokenName, mode) },
    )
}
