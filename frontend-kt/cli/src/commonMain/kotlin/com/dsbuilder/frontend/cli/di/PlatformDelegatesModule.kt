package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry
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
internal expect fun Scope.platformDelegates(): List<PlatformDelegate>

/**
 * Установщики в порядке регистрации.
 *
 * Toolchain без установщика остаётся рабочим: его инструмент ставят руками, а `--tool`
 * и `DSBUILDER_IOS_TOOL` продолжают работать.
 */
internal expect fun Scope.toolchainInstallers(): List<ToolchainInstaller>
