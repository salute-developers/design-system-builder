package com.dsbuilder.frontend.analytics.metrica

import io.ktor.client.HttpClient
import io.ktor.client.request.forms.submitForm
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Parameters
import io.ktor.http.isSuccess

/** Отдельный HTTP-клиент без авторизации DS Builder; перенаправления отключены. */
public class KtorMetricaTransport(private val httpClient: HttpClient) : MetricaTransport {
    private val client = httpClient.config { followRedirects = false }

    override suspend fun send(request: MetricaRequest): Boolean {
        val response = client.submitForm(
            url = "https://mc.yandex.ru/collect",
            formParameters = Parameters.build { request.fields.forEach { (key, value) -> append(key, value) } },
        )
        return response.status.isSuccess() && response.bodyAsText().trim() == "<!-- OK -->"
    }

    override fun close() {
        client.close()
        httpClient.close()
    }
}
