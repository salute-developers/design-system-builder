package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry
import com.dsbuilder.frontend.platform.android.AndroidGradleDelegate
import com.dsbuilder.frontend.platform.ios.IosCliDelegate
import com.dsbuilder.frontend.platform.ios.IosToolchainInstaller
import com.dsbuilder.frontend.platform.web.WebNpmDelegate
import com.dsbuilder.frontend.platform.web.WebToolchainInstaller
import org.koin.core.module.Module
import org.koin.core.scope.Scope
import org.koin.dsl.module

/**
 * Создаёт Koin module с реестром платформенных делегатов.
 *
 * Единственное место в CLI, где перечислены конкретные платформы. Новая платформа добавляется
 * одной строкой в [platformDelegates] после того, как её адаптер появился в модуле
 * `platform-<toolchain>` и зарегистрирован собственным Koin module'ом.
 */
public fun platformDelegatesModule(): Module = module {
    single { PlatformDelegateRegistry(platformDelegates()) }
    single { ToolchainInstallerRegistry(toolchainInstallers()) }
}

/**
 * Делегаты в порядке регистрации.
 */
internal fun Scope.platformDelegates(): List<PlatformDelegate> = buildList {
    if (this@platformDelegates.get<ClientRuntime>().supportsIosToolchain) {
        add(this@platformDelegates.get<IosCliDelegate>())
    }
    add(this@platformDelegates.get<AndroidGradleDelegate>())
    add(this@platformDelegates.get<WebNpmDelegate>())
}

/**
 * Установщики в порядке регистрации.
 *
 * Toolchain без установщика остаётся рабочим: его инструмент ставят руками, а `--tool`
 * и `DSBUILDER_IOS_TOOL` продолжают работать.
 */
internal fun Scope.toolchainInstallers(): List<ToolchainInstaller> = buildList {
    if (this@toolchainInstallers.get<ClientRuntime>().supportsIosToolchain) {
        add(this@toolchainInstallers.get<IosToolchainInstaller>())
    }
    add(this@toolchainInstallers.get<WebToolchainInstaller>())
}
