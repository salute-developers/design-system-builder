package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.presentation.repeatableMutation
import io.ktor.server.application.ApplicationCall

/** Связывает ключ с разобранным запросом и точным ответом без повторной предметной записи. */
internal inline fun <T : Any, reified R> ApplicationCall.repeatableThemeMutation(
    context: DsRequestContext,
    body: Any?,
    status: Int = 200,
    crossinline response: (T) -> R,
): DsRequestContext = repeatableMutation(context, body, status, response = response)
