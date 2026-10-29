package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.winhttp.WinHttp

/** Создаёт нативные Windows-зависимости CLI без JVM. */
public actual fun defaultClientRuntime(): ClientRuntime {
    val httpClient = HttpClient(WinHttp) { configureCliTimeouts() }
    return ClientRuntime(
        fileSystem = WindowsWorkspaceFileSystem,
        environmentReader = EnvironmentReader(WindowsEnvironment::get),
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        processRunner = WindowsProcessRunner,
        credentialStore = FileCredentialStore(WindowsCredentialStoreFileSystem, WindowsCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = WindowsPkcePlatform,
        close = { httpClient.close() },
    )
}
