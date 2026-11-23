package com.dsbuilder.frontend.runtime.node

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js

internal val nodeProcess: dynamic = js("process")

/** Создаёт платформенные зависимости Node.js для CLI и MCP. */
public fun createNodeClientRuntime(
    renderLoginPage: (Boolean) -> String,
    loginPageHeaders: Map<String, String>,
): ClientRuntime {
    val httpClient = HttpClient(Js)
    return ClientRuntime(
        supportsIosToolchain = nodeProcess.platform == "darwin",
        processRunner = NodeProcessRunner,
        fileSystem = NodeWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> nodeProcess.env[name] as? String },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        credentialStore = FileCredentialStore(NodeCredentialStoreFileSystem, NodeCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = NodePkcePlatform(renderLoginPage, loginPageHeaders),
        close = { httpClient.close() },
    )
}
