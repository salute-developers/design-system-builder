package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.platform.android.AndroidGradleDelegate
import com.dsbuilder.frontend.platform.web.WebNpmDelegate
import org.koin.core.scope.Scope

internal actual fun Scope.platformDelegates(): List<PlatformDelegate> = listOf(
    get<AndroidGradleDelegate>(),
    get<WebNpmDelegate>(),
)

internal actual fun Scope.toolchainInstallers(): List<ToolchainInstaller> = emptyList()
