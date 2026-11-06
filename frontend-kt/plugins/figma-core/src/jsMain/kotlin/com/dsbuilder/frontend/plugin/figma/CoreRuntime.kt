package com.dsbuilder.frontend.plugin.figma

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.DeviceAuthorization
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorDeviceAuthorizationClient
import com.dsbuilder.frontend.core.network.KtorTokenExchangeClient
import com.dsbuilder.frontend.feature.auth.application.DeviceLoginFlow
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ThemeContext
import com.dsbuilder.frontend.feature.ds.data.HttpDesignSystemsClient
import com.dsbuilder.frontend.feature.ds.data.HttpThemeTokensClient
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import com.dsbuilder.frontend.feature.projects.data.HttpProjectsClient
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsResult
import com.dsbuilder.frontend.feature.theme.data.HttpDesignSystemTenantsClient
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.plugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.time.Duration.Companion.seconds

private const val LOGIN_SCOPE = "openid profile offline_access"
private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_FORBIDDEN = 403
private const val HTTP_NOT_FOUND = 404

/** Сервер ответил успехом, но разобрать ответ не удалось. */
private const val HTTP_INVALID_RESPONSE = 500

/** Срок запроса выхода: зависший сервер не должен держать очистку сессии. */
private val LOGOUT_TIMEOUT = 5.seconds

/** Сбой сети: движок Ktor для JS бросает `kotlin.Error`, а его не ловит `catch (Exception)` в общих модулях. */
private class TransportFailure(message: String?) : RuntimeException(message)

/** Общие клиенты сворачивают статус в свои коды: экрану нужен исходный. */
private class StatusProbe(private val clients: AuthenticatedHttpClientFactory) : AuthenticatedHttpClientFactory {
    private var failure: AuthenticatedHttpResult.Failure? = null

    /** Статус отказа; `null` — сервер недоступен. Без отказа остаётся непонятный ответ сервера. */
    fun status(): Int? = failure.let { if (it == null) HTTP_INVALID_RESPONSE else it.statusCode }

    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
        observed(clients.create(apiUrl, apiKey))

    override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
        observed(clients.create(apiUrl, credential))

    private fun observed(client: AuthenticatedHttpClient) = object : AuthenticatedHttpClient by client {
        override suspend fun get(path: String): AuthenticatedHttpResult =
            client.get(path).also { if (it is AuthenticatedHttpResult.Failure) failure = failure ?: it }
    }
}

/** Вся работа окна плагина с бэкендом; [DsBuilderCore] только переводит её в вызовы JS. */
internal class CoreRuntime(
    http: HttpClient,
    private val gatewayUrl: String,
    private val clientId: String,
    realm: String,
    storage: SessionStorage,
    private val scope: CoroutineScope,
) {
    init {
        http.plugin(HttpSend).intercept { request ->
            try {
                execute(request)
            } catch (error: Error) {
                throw TransportFailure(error.message)
            }
        }
    }

    private val clients = KtorAuthenticatedHttpClientFactory { http }
    private val deviceClient = KtorDeviceAuthorizationClient(http, gatewayUrl, realm)
    private val login = DeviceLoginFlow(deviceClient, clientId, LOGIN_SCOPE)
    private val session = PluginSession(
        storage,
        KtorTokenExchangeClient(http, "$gatewayUrl/auth/token"),
        deviceClient,
        clientId,
        scope,
    )
    private var pendingDevice: DeviceAuthorization? = null

    fun onSessionExpired(listener: () -> Unit) = session.onExpired(listener)

    suspend fun restore(): Boolean = translated { session.restore() }

    suspend fun signOut() = translated { session.signOut() }

    suspend fun startLogin(): String = translated {
        val device = login.start().also { pendingDevice = it }
        buildJsonObject {
            put("userCode", device.userCode)
            put("verificationUri", device.verificationUri)
        }.toString()
    }

    /** Ждёт подтверждения во внешнем браузере: только этот шаг можно отменить. */
    suspend fun awaitLogin(): TokenExchangeResult = translated {
        login.awaitTokens(checkNotNull(pendingDevice) { "Login was not started." })
    }

    /** Без сохранённого токена офлайн-сессия на сервере осталась бы без владельца, поэтому она завершается в фоне. */
    @Suppress("TooGenericExceptionCaught")
    suspend fun saveLogin(result: TokenExchangeResult) = translated {
        try {
            session.signIn(result)
        } catch (exception: Exception) {
            scope.launch {
                runCatching { withTimeout(LOGOUT_TIMEOUT) { deviceClient.logout(clientId, result.refreshToken) } }
            }
            throw CoreFailure("storage", (exception as? CoreFailure)?.code)
        }
    }

    suspend fun projects(): String = read { probe, credential ->
        when (val result = HttpProjectsClient(probe).listProjects(gatewayUrl, credential)) {
            is ProjectsReadResult.Success -> buildJsonArray {
                result.projects.forEach { add(summary(it.id, it.name, it.description)) }
            }
            is ProjectsReadResult.Failed -> null
        }
    }

    suspend fun designSystems(projectId: String): String = read { probe, credential ->
        when (val result = HttpDesignSystemsClient(probe).list(gatewayUrl, credential, projectId)) {
            is DesignSystemsReadResult.Success -> buildJsonArray {
                result.items.forEach { add(summary(it.id, it.name, it.description)) }
            }
            is DesignSystemsReadResult.Failed -> null
        }
    }

    suspend fun tenants(projectId: String, designSystemId: String): String = read { probe, credential ->
        val client = HttpDesignSystemTenantsClient(probe)
        when (val result = client.listTenants(gatewayUrl, credential, projectId, designSystemId)) {
            is DesignSystemTenantsResult.Success -> buildJsonArray {
                result.tenants.forEach { add(summary(it.id, if (it.named) it.name else null, it.description)) }
            }
            is DesignSystemTenantsResult.Failed -> null
        }
    }

    suspend fun versions(projectId: String, designSystemId: String): String = read { probe, credential ->
        HttpThemeTokensClient(probe).versions(gatewayUrl, credential, projectId, designSystemId).valueOrNull()
    }

    suspend fun themeTokens(context: ThemeContext, versionId: String?): String = read { probe, credential ->
        HttpThemeTokensClient(probe).tokens(gatewayUrl, credential, context, versionId).valueOrNull()
    }

    private fun ModelReadResult.valueOrNull() = (this as? ModelReadResult.Success)?.value

    private fun summary(id: String, name: String?, description: String?): JsonObject = buildJsonObject {
        put("id", id)
        put("name", name)
        put("description", description)
    }

    /** Отказ чтения превращается в [HttpFailure] с исходным статусом, чтобы сессия могла повторить запрос после `401`. */
    private suspend fun read(
        request: suspend (AuthenticatedHttpClientFactory, BackendCredential) -> JsonElement?,
    ): String = translated {
        session.authorized { credential ->
            val probe = StatusProbe(clients)
            val value = request(probe, credential)
            value?.toString() ?: throw HttpFailure(probe.status())
        }
    }

    @Suppress("TooGenericExceptionCaught", "RethrowCaughtException")
    private suspend fun <T> translated(block: suspend () -> T): T = try {
        block()
    } catch (exception: CancellationException) {
        throw exception
    } catch (failure: CoreFailure) {
        throw failure
    } catch (failure: HttpFailure) {
        throw CoreFailure(kindOf(failure.status), null)
    } catch (exception: TokenExchangeException) {
        throw exception.oauthError?.let { CoreFailure("oauth", it) } ?: CoreFailure("network", null)
    } catch (exception: Exception) {
        throw CoreFailure("network", null)
    }

    private fun kindOf(status: Int?): String = when (status) {
        null -> "network"
        HTTP_UNAUTHORIZED -> "unauthorized"
        HTTP_FORBIDDEN -> "forbidden"
        HTTP_NOT_FOUND -> "not-found"
        else -> "server"
    }
}
