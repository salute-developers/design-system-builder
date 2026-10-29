package com.dsbuilder.documentation.app

import com.dsbuilder.runtime.RuntimeHandle
import com.dsbuilder.runtime.RuntimeReadiness
import io.ktor.server.application.Application
import io.ktor.server.routing.Route
import kotlin.time.Duration

/** Ресурсы документации без собственного сервера и глобального контейнера DI. */
class DocumentationRuntime internal constructor(
    private val ready: suspend () -> RuntimeReadiness,
    private val routes: Route.() -> Unit,
    private val workers: Application.() -> List<kotlinx.coroutines.Job>,
    private val release: () -> Unit,
) : RuntimeHandle {
    private var jobs: List<kotlinx.coroutines.Job> = emptyList()
    private val closed = java.util.concurrent.atomic.AtomicBoolean()

    /** Регистрирует только предметные маршруты. */
    fun registerRoutes(route: Route) = routes(route)

    /** Запускает ограниченные обработчики в управляемом жизненном цикле приложения. */
    fun start(application: Application) { jobs = workers(application) }

    override suspend fun readiness(): RuntimeReadiness =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { ready() }

    override suspend fun stop(gracePeriod: Duration) {
        jobs.forEach { it.cancel() }
        kotlinx.coroutines.withTimeoutOrNull(gracePeriod) { jobs.forEach { it.join() } }
        close()
    }
    override fun close() {
        if (closed.compareAndSet(false, true)) {
            jobs.forEach { it.cancel() }
            release()
        }
    }
}
