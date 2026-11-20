@file:OptIn(ExperimentalJsExport::class)

package com.dsbuilder.frontend.plugin.figma

import com.dsbuilder.frontend.feature.ds.application.ThemeContext
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.asPromise
import kotlinx.coroutines.async
import kotlinx.coroutines.await
import kotlinx.coroutines.coroutineScope
import org.khronos.webgl.Int8Array
import kotlin.js.Promise

private const val REFRESH_TOKEN_KEY = "refresh-token"

/**
 * Отказ для экранов.
 *
 * @property kind `unauthorized`, `forbidden`, `not-found`, `server`, `network`, `oauth`, `storage` или `export`.
 * @property code код OAuth для вида `oauth`, причина для `storage` и `export`.
 */
@JsExport
public class CoreFailure(public val kind: String, public val code: String?) : RuntimeException(kind)

/** Хранилище основного потока плагина. */
@JsExport
public external interface CoreStorage {
    public fun get(key: String): Promise<String?>

    public fun set(key: String, value: String): Promise<Unit>

    public fun delete(key: String): Promise<Unit>
}

/** Часть `AbortSignal`, которая нужна для отмены запроса: стандартная библиотека Kotlin этот тип не описывает. */
@JsExport
public external interface CoreSignal {
    public val aborted: Boolean

    public fun addEventListener(type: String, listener: () -> Unit)
}

private class HostSessionStorage(private val host: CoreStorage) : SessionStorage {
    override suspend fun get(): String? = reading { host.get(REFRESH_TOKEN_KEY).await() }

    override suspend fun set(refreshToken: String) = reading { host.set(REFRESH_TOKEN_KEY, refreshToken).await() }

    override suspend fun delete() = reading { host.delete(REFRESH_TOKEN_KEY).await() }

    /** Отказ хранилища не сетевой: экран показывает его причину, а не недоступность сервера. */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun <T> reading(call: suspend () -> T): T = try {
        call()
    } catch (exception: CancellationException) {
        throw exception
    } catch (exception: Throwable) {
        throw CoreFailure("storage", exception.message)
    }
}

/** API общих Kotlin-модулей для окна плагина. Данные возвращаются строками JSON, отказы — [CoreFailure]. */
@JsExport
public class DsBuilderCore(gatewayUrl: String, clientId: String, realm: String, storage: CoreStorage) {
    private val scope: CoroutineScope = MainScope()
    private val runtime = CoreRuntime(HttpClient(Js), gatewayUrl, clientId, realm, HostSessionStorage(storage), scope)

    public fun onSessionExpired(listener: () -> Unit): Unit = runtime.onSessionExpired(listener)

    public fun restore(): Promise<Boolean> = run(null) { runtime.restore() }

    public fun startLogin(): Promise<String> = run(null) { runtime.startLogin() }

    /** Отмена действует, пока токены не получены: вход с полученными токенами завершается. */
    public fun completeLogin(signal: CoreSignal?): Promise<Unit> = run(null) {
        runtime.saveLogin(cancellable(signal) { runtime.awaitLogin() })
    }

    public fun signOut(): Promise<Unit> = run(null) { runtime.signOut() }

    public fun projects(signal: CoreSignal?): Promise<String> = run(signal) { runtime.projects() }

    public fun designSystems(projectId: String, signal: CoreSignal?): Promise<String> =
        run(signal) { runtime.designSystems(projectId) }

    public fun tenants(projectId: String, designSystemId: String, signal: CoreSignal?): Promise<String> =
        run(signal) { runtime.tenants(projectId, designSystemId) }

    public fun versions(projectId: String, designSystemId: String, signal: CoreSignal?): Promise<String> =
        run(signal) { runtime.versions(projectId, designSystemId) }

    public fun themeTokens(
        projectId: String,
        designSystemId: String,
        tenantId: String,
        versionId: String?,
        signal: CoreSignal?,
    ): Promise<String> = run(signal) {
        runtime.themeTokens(ThemeContext(projectId, designSystemId, tenantId), versionId)
    }

    /** План экспорта темы в Figma строкой JSON; документ Figma меняет основной поток плагина. */
    @Suppress("LongParameterList")
    public fun exportPlan(
        projectId: String,
        designSystemId: String,
        tenantId: String,
        versionId: String?,
        themeName: String,
        platform: String,
        bindGradientStops: Boolean,
        signal: CoreSignal?,
    ): Promise<String> = run(signal) {
        runtime.exportPlan(
            ThemeContext(projectId, designSystemId, tenantId),
            versionId,
            themeName,
            platform,
            bindGradientStops,
        )
    }

    /** Байты файла по публичной ссылке `https`, например файла шрифта: окно собирает из них архив. */
    public fun fontFile(url: String, signal: CoreSignal?): Promise<Int8Array> = run(signal) {
        runtime.publicFile(url).unsafeCast<Int8Array>()
    }

    private fun <T> run(signal: CoreSignal?, block: suspend () -> T): Promise<T> =
        scope.async { cancellable(signal, block) }.asPromise()

    private suspend fun <T> cancellable(signal: CoreSignal?, block: suspend () -> T): T = coroutineScope {
        val job = async { block() }
        signal?.addEventListener("abort", { job.cancel() })
        if (signal?.aborted == true) job.cancel()
        job.await()
    }
}
