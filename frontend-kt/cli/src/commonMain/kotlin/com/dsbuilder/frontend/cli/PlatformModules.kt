package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.platform.android.androidPlatformModule
import com.dsbuilder.frontend.platform.ios.iosPlatformModule
import com.dsbuilder.frontend.platform.web.webPlatformModule
import org.koin.core.module.Module

/** Модули и реестры используют одну и ту же доступность инструментов из runtime. */
internal fun platformModules(supportsIos: Boolean): List<Module> = buildList {
    if (supportsIos) add(iosPlatformModule())
    add(androidPlatformModule())
    add(webPlatformModule())
}
