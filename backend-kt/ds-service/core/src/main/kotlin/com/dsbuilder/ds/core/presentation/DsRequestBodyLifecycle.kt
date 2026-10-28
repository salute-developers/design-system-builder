package com.dsbuilder.ds.core.presentation

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.util.AttributeKey

private val bodyConsumedKey = AttributeKey<(ApplicationCall) -> Unit>("ds.body.consumed")

/** Подключает наблюдение входа за завершением потокового чтения тела. */
fun Application.configureDsBodyConsumption(observer: (ApplicationCall) -> Unit) {
    attributes.put(bodyConsumedKey, observer)
}

/** Сообщает входу о завершении чтения, не меняя прикладную операцию. */
fun ApplicationCall.dsRequestBodyConsumed() {
    application.attributes.getOrNull(bodyConsumedKey)?.invoke(this)
}
