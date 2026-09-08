package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.platform.ios.IosCliDelegate
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
