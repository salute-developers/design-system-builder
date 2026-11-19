package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.data.ViewAxisBackfill
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import io.ktor.server.application.Application
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory

/**
 * Запускает разовую задачу [ViewAxisBackfill] в фоне после старта: HTTP не ждёт её завершения,
 * а ошибка задачи только пишется в лог и не останавливает сервис.
 */
@Suppress("TooGenericExceptionCaught") // любая ошибка фоновой задачи не должна ронять сервис
fun Application.launchViewAxisBackfill(runtime: DsRuntime) {
    val backfill = ViewAxisBackfill(ExposedTransactionRunner(runtime.database, PostgresTransactionFailureMapper()))
    launch(Dispatchers.IO) {
        try {
            backfill.run()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            LoggerFactory.getLogger(ViewAxisBackfill::class.java).error("View axis backfill failed", failure)
        }
    }
}
