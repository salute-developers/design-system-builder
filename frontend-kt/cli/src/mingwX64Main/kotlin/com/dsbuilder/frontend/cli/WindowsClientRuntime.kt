package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.analytics.metrica.KtorMetricaTransport
import com.dsbuilder.frontend.analytics.metrica.MetricaConfig
import com.dsbuilder.frontend.analytics.metrica.createMetricaAnalytics
import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.winhttp.WinHttp
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

/** Создаёт нативные Windows-зависимости CLI без JVM. */
public actual fun defaultClientRuntime(): ClientRuntime {
    val httpClient = HttpClient(WinHttp) { configureCliTimeouts() }
    val consent = createCliConsent(
        WindowsCredentialStoreFileSystem,
        WindowsCredentialStoreLock,
        EnvironmentReader(WindowsEnvironment::get),
        WindowsPkcePlatform,
        { HttpClient(WinHttp) { followRedirects = false } },
    )
    return ClientRuntime(
        analyticsConsent = consent,
        fileSystem = WindowsWorkspaceFileSystem,
        environmentReader = EnvironmentReader(WindowsEnvironment::get),
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        processRunner = WindowsProcessRunner,
        credentialStore = FileCredentialStore(WindowsCredentialStoreFileSystem, WindowsCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = WindowsPkcePlatform,
        close = {
            consent.close()
            httpClient.close()
        },
    )
}

@OptIn(ExperimentalTime::class)
internal actual fun platformAnalytics(
    config: MetricaConfig,
    channel: String,
    allowed: suspend () -> Boolean,
): Analytics {
    return createMetricaAnalytics(
        config,
        AnalyticsContext(channel, VERSION, "windows"),
        CliMetricaIdentityStore(WindowsCredentialStoreFileSystem, WindowsCredentialStoreLock),
        ConsentMetricaTransport(KtorMetricaTransport(HttpClient(WinHttp)), allowed),
        { Clock.System.now().epochSeconds },
    )
}
