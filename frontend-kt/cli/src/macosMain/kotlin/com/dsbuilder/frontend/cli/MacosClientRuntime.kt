package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.analytics.metrica.KtorMetricaTransport
import com.dsbuilder.frontend.analytics.metrica.MetricaConfig
import com.dsbuilder.frontend.analytics.metrica.createMetricaAnalytics
import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.auth.ProcessCredentialStoreLock
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.toKString
import platform.posix.chmod
import platform.posix.getenv
import platform.posix.rename
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

/**
 * Создает macOS runtime-зависимости CLI.
 */
@OptIn(ExperimentalForeignApi::class)
public actual fun defaultClientRuntime(): ClientRuntime {
    val httpClient = HttpClient(Darwin) {
        configureCliTimeouts()
    }
    return ClientRuntime(
        fileSystem = MacosWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> getenv(name)?.toKString() },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        processRunner = MacosProcessRunner,
        credentialStore = FileCredentialStore(MacosCredentialStoreFileSystem, MacosCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = MacosPkcePlatform,
        close = { httpClient.close() },
    )
}

@OptIn(ExperimentalForeignApi::class)
internal object MacosCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String =
        getenv("HOME")?.toKString() ?: MacosWorkspaceFileSystem.currentWorkingDirectory()

    override fun resolve(parent: String, child: String): String = MacosWorkspaceFileSystem.resolve(parent, child)

    override fun exists(path: String): Boolean = MacosWorkspaceFileSystem.exists(path)

    override fun createDirectories(path: String) {
        MacosWorkspaceFileSystem.createDirectories(path)
    }

    override fun readText(path: String): String = MacosWorkspaceFileSystem.readText(path)

    override fun writeText(path: String, text: String) {
        MacosWorkspaceFileSystem.writeText(path, text)
    }

    override fun atomicReplace(source: String, target: String) {
        rename(source, target)
    }

    override fun deleteFile(path: String) {
        MacosWorkspaceFileSystem.deleteFile(path)
    }

    override fun setPosixPermissions(path: String, mode: String) {
        chmod(path, mode.toUShort(radix = 8))
    }
}

internal object MacosCredentialStoreLock : CredentialStoreLock by ProcessCredentialStoreLock(
    MacosCredentialLockPlatform,
)

@OptIn(ExperimentalTime::class, ExperimentalForeignApi::class)
internal actual fun platformAnalytics(config: MetricaConfig, channel: String): Analytics {
    return createMetricaAnalytics(
        config,
        AnalyticsContext(channel, VERSION, "macos"),
        CliMetricaIdentityStore(MacosCredentialStoreFileSystem, MacosCredentialStoreLock) {
            getenv("HOME")?.toKString() ?: error("Analytics home is unavailable")
        },
        KtorMetricaTransport(HttpClient(Darwin)),
        { Clock.System.now().epochSeconds },
    )
}
