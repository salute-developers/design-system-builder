package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.platform.android.AndroidGradleDelegate
import com.dsbuilder.frontend.platform.ios.IosCliDelegate
import com.dsbuilder.frontend.platform.ios.IosToolchainInstaller
import com.dsbuilder.frontend.platform.web.WebNpmDelegate
import com.dsbuilder.frontend.platform.web.WebToolchainInstaller
import org.koin.core.scope.Scope

internal actual fun Scope.platformDelegates(): List<PlatformDelegate> = buildList {
    if (js("process.platform") == "darwin") add(this@platformDelegates.get<IosCliDelegate>())
    add(this@platformDelegates.get<AndroidGradleDelegate>())
    add(this@platformDelegates.get<WebNpmDelegate>())
}

internal actual fun Scope.toolchainInstallers(): List<ToolchainInstaller> = buildList {
    if (js("process.platform") == "darwin") add(this@toolchainInstallers.get<IosToolchainInstaller>())
    add(this@toolchainInstallers.get<WebToolchainInstaller>())
}
