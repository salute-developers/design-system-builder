package com.dsbuilder.ds.app

import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.runTestApplication
import io.ktor.test.dispatcher.runTestWithRealTime
import kotlin.time.Duration.Companion.minutes

/** Предел реального времени одного интеграционного сценария на общем медленном раннере CI. */
val INTEGRATION_TEST_TIMEOUT = 5.minutes

/**
 * Замена `io.ktor.server.testing.testApplication` для сценариев с PostgreSQL.
 *
 * Ktor 3.3 зашивает в `testApplication` предел `runTest` в 60 секунд, и изменить его нельзя ни параметром, ни
 * системным свойством kotlinx-coroutines-test. Локально самый долгий сценарий занимает около 22 секунд, но на раннере
 * GitHub Actions все тесты идут в 3–4 раза медленнее, и разные сценарии стабильно упирались в минуту. Тело сценария
 * то же самое, меняется только предел.
 */
fun integrationTestApplication(block: suspend ApplicationTestBuilder.() -> Unit) {
    runTestWithRealTime(timeout = INTEGRATION_TEST_TIMEOUT) { runTestApplication { block() } }
}
