package com.dsbuilder.documentation.app

import com.dsbuilder.runtime.RuntimeReadiness
import kotlinx.coroutines.CancellationException

/** Проверяет обязательные зависимости раздельно; подробные ошибки не попадают в публичную диагностику. */
internal suspend fun documentationReadiness(
    database: suspend () -> Boolean,
    storage: suspend () -> Boolean,
): RuntimeReadiness {
    suspend fun available(check: suspend () -> Boolean): Boolean = try {
        check()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        false
    }
    val checks = mapOf("database" to available(database), "storage" to available(storage))
    return RuntimeReadiness(checks.values.all { it }, checks)
}
