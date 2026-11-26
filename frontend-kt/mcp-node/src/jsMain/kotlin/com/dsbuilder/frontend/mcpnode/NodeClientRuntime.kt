package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.coreApplicationModule
import com.dsbuilder.frontend.feature.auth.authApplicationModule
import com.dsbuilder.frontend.feature.components.componentsApplicationModule
import com.dsbuilder.frontend.feature.docs.docsApplicationModule
import com.dsbuilder.frontend.feature.ds.dsApplicationModule
import com.dsbuilder.frontend.feature.projects.projectsApplicationModule
import com.dsbuilder.frontend.feature.status.statusApplicationModule
import com.dsbuilder.frontend.feature.theme.themeApplicationModule
import com.dsbuilder.frontend.runtime.node.createNodeClientRuntime
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
            projectsApplicationModule(),
            componentsApplicationModule(),
            themeApplicationModule(),
        )
    }.koin

internal fun defaultNodeRuntime(): ClientRuntime = createNodeClientRuntime(
    com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage::render,
    com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage.headers,
)
