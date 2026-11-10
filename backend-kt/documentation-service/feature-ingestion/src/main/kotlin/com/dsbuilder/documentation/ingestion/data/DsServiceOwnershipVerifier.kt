package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.DesignSystemOwnershipVerifier
import com.dsbuilder.documentation.ingestion.application.OwnershipResult
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpStatusCode
import io.ktor.http.encodeURLPathPart
import kotlinx.coroutines.CancellationException

/** HTTP adapter проверки design system через ds-service. */
class DsServiceOwnershipVerifier(private val client: HttpClient, baseUrl: String) : DesignSystemOwnershipVerifier {
    private val baseUrl = baseUrl.trimEnd('/')

    override suspend fun verify(id: String, actor: ActorContext): OwnershipResult = try {
        val response = client.get("$baseUrl/api/ds/design-systems/${id.encodeURLPathPart()}") {
            header("X-Actor-Type", actor.type.name.lowercase())
            header("X-Project-Id", actor.projectId)
            header("X-User-Id", actor.actorId)
            actor.projectRole?.let { header("X-Project-Role", it) }
            actor.personalAccessTokenId?.let { header("X-Personal-Access-Token-Id", it) }
            if (actor.type == ActorType.PERSONAL_ACCESS_TOKEN) {
                header("X-Project-Scopes", actor.projectScopes.joinToString(","))
            }
            header("X-System-Admin", actor.systemAdmin.toString())
        }
        when (response.status) {
            HttpStatusCode.OK -> OwnershipResult.OWNED
            HttpStatusCode.NotFound -> OwnershipResult.NOT_FOUND
            HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden -> OwnershipResult.FORBIDDEN
            else -> OwnershipResult.UNAVAILABLE
        }
    } catch (_: HttpRequestTimeoutException) {
        OwnershipResult.UNAVAILABLE
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        OwnershipResult.UNAVAILABLE
    }
}
