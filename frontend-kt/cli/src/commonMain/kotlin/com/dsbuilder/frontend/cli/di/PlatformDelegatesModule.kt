package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry
import com.dsbuilder.frontend.platform.ios.IosCliDelegate
import com.dsbuilder.frontend.platform.ios.IosToolchainInstaller
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
 *
 * Адаптер `platform-android` приезжает отдельным изменением и добавляется сюда
 * как `get<AndroidGradleDelegate>()`.
 */
private fun Scope.platformDelegates(): List<PlatformDelegate> = listOf(
    get<IosCliDelegate>(),
)

/**
 * Установщики в порядке регистрации.
 *
 * Toolchain без установщика остаётся рабочим: его инструмент ставят руками, а `--tool`
 * и `DSBUILDER_IOS_TOOL` продолжают работать.
 */
private fun Scope.toolchainInstallers(): List<ToolchainInstaller> = listOf(
    get<IosToolchainInstaller>(),
)
