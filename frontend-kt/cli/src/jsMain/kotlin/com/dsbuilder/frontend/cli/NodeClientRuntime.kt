package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.analytics.metrica.KtorMetricaTransport
import com.dsbuilder.frontend.analytics.metrica.MetricaConfig
import com.dsbuilder.frontend.analytics.metrica.createMetricaAnalytics
import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage
import com.dsbuilder.frontend.runtime.node.NodeCredentialStoreFileSystem
import com.dsbuilder.frontend.runtime.node.NodeCredentialStoreLock
import com.dsbuilder.frontend.runtime.node.createNodeClientRuntime
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

/** Создаёт Node runtime CLI, включая общую политику согласия. */
public actual fun defaultClientRuntime(): ClientRuntime {
    val runtime = createNodeClientRuntime(BrowserLoginPage::render, BrowserLoginPage.headers)
    val consent = createCliConsent(
        NodeCredentialStoreFileSystem,
        NodeCredentialStoreLock,
        runtime.environmentReader,
        runtime.pkcePlatform,
        { HttpClient(Js) { followRedirects = false } },
    )
    return runtime.copy(analyticsConsent = consent, close = {
        consent.close()
        runtime.close()
    })
}

@OptIn(ExperimentalTime::class)
internal actual fun platformAnalytics(
    config: MetricaConfig,
    channel: String,
    allowed: suspend () -> Boolean,
): Analytics = createMetricaAnalytics(
    config,
    AnalyticsContext(channel, VERSION, nodeOs()),
    CliMetricaIdentityStore(NodeCredentialStoreFileSystem, NodeCredentialStoreLock),
    ConsentMetricaTransport(KtorMetricaTransport(HttpClient(Js)), allowed),
    { Clock.System.now().epochSeconds },
)

private fun nodeOs(): String = when (js("process.platform") as String) {
    "win32" -> "windows"
    "darwin" -> "macos"
    "linux" -> "linux"
    else -> "other"
}
