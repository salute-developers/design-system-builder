package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
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
 * Пока пусто: адаптеры `platform-android` и `platform-ios` приезжают отдельными изменениями
 * и добавляются сюда как `get<AndroidGradleDelegate>()`, `get<IosCliDelegate>()`.
 */
@Suppress("UnusedReceiverParameter")
private fun Scope.platformDelegates(): List<PlatformDelegate> = emptyList()
