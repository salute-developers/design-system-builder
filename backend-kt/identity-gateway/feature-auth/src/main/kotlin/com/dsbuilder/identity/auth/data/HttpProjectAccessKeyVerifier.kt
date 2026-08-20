package com.dsbuilder.identity.auth.data

import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable

internal class HttpProjectAccessKeyVerifier(
    private val configuration: ProjectAccessConfiguration.Http,
    private val client: HttpClient = defaultProjectAccessHttpClient(configuration),
) : ProjectAccessKeyVerifier {
    override suspend fun verify(token: String): ProjectAccessKeyVerificationResult =
        runCatching {
            val response = client.post("${configuration.baseUrl}/internal/access-keys/verify") {
                contentType(ContentType.Application.Json)
                header("X-Internal-Api-Key", configuration.internalApiKey)
                setBody(VerifyProjectAccessKeyHttpRequest(token = token))
            }

            when (response.status) {
                HttpStatusCode.OK -> {
                    val body = response.body<VerifyProjectAccessKeyHttpResponse>()
                    ProjectAccessKeyVerificationResult.Valid(
                        keyId = body.keyId,
                        projectId = body.projectId,
                        scopes = body.scopes.toSet(),
                    )
                }
                HttpStatusCode.Unauthorized,
                HttpStatusCode.Forbidden,
                -> ProjectAccessKeyVerificationResult.Invalid
                else -> ProjectAccessKeyVerificationResult.Unavailable
            }
        }.getOrElse {
            ProjectAccessKeyVerificationResult.Unavailable
        }
}

@Serializable
internal data class VerifyProjectAccessKeyHttpRequest(
    val token: String,
)

@Serializable
internal data class VerifyProjectAccessKeyHttpResponse(
    val projectId: String,
    val keyId: String,
    val scopes: List<String>,
)

private fun defaultProjectAccessHttpClient(configuration: ProjectAccessConfiguration.Http): HttpClient =
    HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
        install(HttpTimeout) {
            requestTimeoutMillis = configuration.timeout.inWholeMilliseconds
            connectTimeoutMillis = configuration.timeout.inWholeMilliseconds
            socketTimeoutMillis = configuration.timeout.inWholeMilliseconds
        }
    }
