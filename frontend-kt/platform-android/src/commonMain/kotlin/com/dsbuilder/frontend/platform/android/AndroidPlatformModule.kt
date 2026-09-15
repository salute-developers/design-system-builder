package com.dsbuilder.frontend.platform.android

import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создаёт Koin module платформы Android.
 *
 * Делегат не попадает в реестр отсюда: его состав задаёт composition root клиента. Установщика
 * нет: ставить нечего — `gradlew` уже часть проверенного пользователем Gradle-проекта.
 */
public fun androidPlatformModule(): Module = module {
    single {
        AndroidGradleDelegate(
            processRunner = get<ProcessRunner>(),
            locator = AndroidGradleLocator(fileSystem = get<WorkspaceFileSystem>()),
        )
    }
}
