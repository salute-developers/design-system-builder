package com.dsbuilder.frontend.plugin.androidstudio

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.KtorTokenExchangeClient
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.auth.IdeBrowserLauncher
import com.dsbuilder.frontend.plugin.androidstudio.auth.LoginController
import com.dsbuilder.frontend.plugin.androidstudio.auth.PasswordSafeRefreshTokenStore
import com.dsbuilder.frontend.plugin.androidstudio.auth.SessionRefresher
import com.dsbuilder.frontend.plugin.androidstudio.projects.HttpProjectsClient
import com.dsbuilder.frontend.plugin.androidstudio.projects.ListProjectsUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GetDesignSystemTokensUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.HttpDesignSystemDataClient
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ListDesignSystemsUseCase
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO

/**
 * Композиционный корень плагина: связывает общие модули `core-*` с платформенными
 * реализациями портов (браузер, `PasswordSafe`). Простой `object` — плагин не заводит
 * DI-фреймворк ради небольшого набора singleton-зависимостей.
 */
public object PluginServices {
    private val environmentReader = EnvironmentReader { name -> System.getenv(name) }
    private val apiUrl by lazy { ApiUrlResolver(environmentReader).resolve(override = null).value }
    private val httpClient by lazy { HttpClient(CIO) }
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
    public val sessionRefresher: SessionRefresher by lazy { SessionRefresher(tokenExchangeClient, sessionResolver) }
    private val authenticatedApiClient by lazy {
        AuthenticatedApiClient(httpClient, apiUrl, sessionResolver, sessionRefresher)
    }

    /** Контроллер экрана логина — один на процесс плагина. */
    public val loginController: LoginController by lazy {
        LoginController(
            gatewayBaseUrl = apiUrl,
            tokenExchangeClient = tokenExchangeClient,
            sessionResolver = sessionResolver,
            browserLauncher = IdeBrowserLauncher(),
        )
    }

    /** Use case списка проектов пользователя — для главного экрана. */
    public val listProjects: ListProjectsUseCase by lazy {
        ListProjectsUseCase(HttpProjectsClient(authenticatedApiClient))
    }

    /** Use case списка дизайн-систем проекта. */
    public val listDesignSystems: ListDesignSystemsUseCase by lazy {
        ListDesignSystemsUseCase(HttpDesignSystemDataClient(authenticatedApiClient))
    }

    /** Use case получения токенов дизайн-системы со значениями для платформы. */
    public val getDesignSystemTokens: GetDesignSystemTokensUseCase by lazy {
        GetDesignSystemTokensUseCase(HttpDesignSystemDataClient(authenticatedApiClient))
    }
}
