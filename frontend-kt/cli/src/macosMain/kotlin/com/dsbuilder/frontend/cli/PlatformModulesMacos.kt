package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.platform.android.androidPlatformModule
import com.dsbuilder.frontend.platform.ios.iosPlatformModule
import com.dsbuilder.frontend.platform.web.webPlatformModule
import org.koin.core.module.Module

internal actual fun platformModules(): List<Module> = listOf(
    iosPlatformModule(),
    androidPlatformModule(),
    webPlatformModule(),
)
