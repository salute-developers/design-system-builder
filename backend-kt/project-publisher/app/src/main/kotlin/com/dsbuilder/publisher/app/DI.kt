package com.dsbuilder.publisher.app

import com.dsbuilder.core.DatabaseProvider
import com.dsbuilder.core.DatabaseProviderImpl
import com.dsbuilder.feature.publisher.di.PublishModule
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.koin.core.qualifier.StringQualifier
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

fun Application.configureKoin() {
    install(Koin) {
        slf4jLogger(level = org.koin.core.logger.Level.ERROR)
        modules(
            module {
                single<DatabaseProvider> { DatabaseProviderImpl() }
                val appJob = SupervisorJob()
                val appScope = CoroutineScope(appJob + Dispatchers.Default)
                // гарантируем отмену при остановке приложения
                monitor.subscribe(ApplicationStopped) {
                    appJob.cancel() // отменяем все фоновые корутины
                }
                single<CoroutineScope>(qualifier = StringQualifier("appScope")) { appScope }
            },
            PublishModule.beans,
        )
    }
}