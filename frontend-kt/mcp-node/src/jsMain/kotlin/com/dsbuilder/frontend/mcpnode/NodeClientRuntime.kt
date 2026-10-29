package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.coreApplicationModule
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import com.dsbuilder.frontend.feature.auth.authApplicationModule
import com.dsbuilder.frontend.feature.components.componentsApplicationModule
import com.dsbuilder.frontend.feature.docs.docsApplicationModule
import com.dsbuilder.frontend.feature.ds.dsApplicationModule
import com.dsbuilder.frontend.feature.status.statusApplicationModule
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import org.koin.core.Koin
import org.koin.core.component.get
import org.koin.dsl.koinApplication

internal val nodeProcess: dynamic = js("process")

internal fun nodeKoin(runtime: ClientRuntime): Koin =
    koinApplication {
        modules(
            coreApplicationModule(runtime),
            authApplicationModule(),
            statusApplicationModule(),
            docsApplicationModule(),
            dsApplicationModule(),
            componentsApplicationModule(),
        )
    }.koin

internal fun defaultNodeRuntime(): ClientRuntime {
    val httpClient = HttpClient(Js)
    return ClientRuntime(
        fileSystem = NodeWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> nodeProcess.env[name] as? String },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        credentialStore = FileCredentialStore(NodeCredentialStoreFileSystem, NodeCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = NodePkcePlatform,
        close = { httpClient.close() },
    )
}
