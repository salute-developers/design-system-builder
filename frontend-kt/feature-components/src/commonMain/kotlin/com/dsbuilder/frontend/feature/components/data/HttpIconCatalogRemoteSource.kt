package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.feature.components.application.IconCatalogCounts
import com.dsbuilder.frontend.feature.components.application.IconCatalogRemoteSource
import com.dsbuilder.frontend.feature.components.application.IconCatalogReport
import com.dsbuilder.frontend.feature.components.application.IconInUse
import com.dsbuilder.frontend.feature.components.application.IconReconciliation
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** HTTP adapter отправки каталога иконок: один JSON-запрос `POST /api/admin/icons/catalog`. */
internal class HttpIconCatalogRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : IconCatalogRemoteSource {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    /**
     * Транспортные отказы Ktor приходят типами конкретных движков без общего супертипа в `commonMain`: без перехвата
     * недоступный backend ронял бы CLI необработанным исключением.
     */
    @Suppress("TooGenericExceptionCaught")
    override suspend fun publish(command: PublishIconCatalogRemoteCommand): PublishIconCatalogRemoteResult {
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)
        val response = try {
            client.postJson(
                "$PATH?dryRun=${command.dryRun}&allowRemovingUsed=${command.allowRemovingUsed}",
                IconManifestJson.encode(command.manifest),
            )
        } catch (exception: Exception) {
            return PublishIconCatalogRemoteResult.Failed(transportMessage(exception))
        }
        return map(response)
    }

    private fun map(response: AuthenticatedHttpResponse): PublishIconCatalogRemoteResult =
        when (response.statusCode) {
            in SUCCESS -> parse(response.body)
            CONFLICT -> conflict(response.body)
            BAD_REQUEST -> PublishIconCatalogRemoteResult.Failed(
                "Status: rejected. Backend refused the catalog: ${reason(response.body) ?: "invalid request"}.",
            )
            UNAUTHORIZED -> PublishIconCatalogRemoteResult.Failed(
                "Status: unauthorized. Credential is missing or invalid.".withReason(reason(response.body)),
            )
            FORBIDDEN -> PublishIconCatalogRemoteResult.Failed(
                "Status: forbidden. Credential has no right to publish the icon catalog.".withReason(
                    reason(response.body),
                ),
            )
            PAYLOAD_TOO_LARGE -> PublishIconCatalogRemoteResult.Failed(
                "Status: payload too large. Backend refused a catalog larger than its request limit.",
            )
            UNAVAILABLE -> PublishIconCatalogRemoteResult.Failed(
                "Status: unavailable. Icon storage is not configured on the backend.".withReason(
                    reason(response.body),
                ),
            )
            else -> PublishIconCatalogRemoteResult.Failed(
                "Status: failed. Backend returned HTTP ${response.statusCode}: " +
                    (reason(response.body) ?: response.body.lineSequence().firstOrNull().orEmpty().take(MESSAGE_LIMIT)),
            )
        }

    private fun parse(body: String): PublishIconCatalogRemoteResult = try {
        PublishIconCatalogRemoteResult.Published(
            json.decodeFromString(IconCatalogResponse.serializer(), body).toReport(),
        )
    } catch (exception: SerializationException) {
        unreadable(exception.message)
    } catch (exception: IllegalArgumentException) {
        unreadable(exception.message)
    }

    private fun unreadable(detail: String?) = PublishIconCatalogRemoteResult.Failed(
        "Error: backend returned a successful status with an unreadable catalog report: " +
            "${detail?.lineSequence()?.firstOrNull() ?: "unexpected shape"}.",
    )

    /** `409`: `icons_in_use` с перечнем иконок либо иной конфликт с сообщением backend. */
    private fun conflict(body: String): PublishIconCatalogRemoteResult {
        val root = runCatching { json.parseToJsonElement(body) }.getOrNull() as? JsonObject
        val code = (root?.get("code") as? JsonPrimitive)?.takeIf { it.isString }?.content
        val message = reason(body) ?: "Icon catalog conflict."
        if (code != IN_USE_CODE && message != IN_USE_CODE) return PublishIconCatalogRemoteResult.Failed(message)
        val items = runCatching {
            val source = (root?.get("details") as? JsonObject) ?: root
            source?.get("removedInUse")?.let { json.decodeFromJsonElement(IN_USE_LIST, it) }.orEmpty()
        }.getOrDefault(emptyList()).map { IconInUse(it.name, it.sizes, it.references) }
        return PublishIconCatalogRemoteResult.InUse(items, message)
    }

    /** Причина отказа из полей `message` и `error` JSON-тела ответа. */
    private fun reason(body: String): String? {
        val root = runCatching { Json.parseToJsonElement(body) }.getOrNull() as? JsonObject ?: return null
        return listOf("message", "error", "code").firstNotNullOfOrNull { field ->
            (root[field] as? JsonPrimitive)?.takeIf { it.isString }?.content
        }?.lineSequence()?.firstOrNull()?.trim()?.takeIf(String::isNotEmpty)?.take(MESSAGE_LIMIT)
    }

    private fun String.withReason(reason: String?): String = if (reason == null) this else "$this Server: $reason"

    private fun transportMessage(exception: Exception): String =
        exception.message?.lineSequence()?.firstOrNull()
            ?.let { "Status: failed. Backend is unreachable: $it" }
            ?: "Status: failed. Backend is unreachable."

    private companion object {
        const val PATH = "/api/admin/icons/catalog"
        const val IN_USE_CODE = "icons_in_use"
        const val BAD_REQUEST = 400
        const val UNAUTHORIZED = 401
        const val FORBIDDEN = 403
        const val CONFLICT = 409
        const val PAYLOAD_TOO_LARGE = 413
        const val UNAVAILABLE = 503
        const val MESSAGE_LIMIT = 200
        val SUCCESS = 200..299
    }
}

@Serializable
private data class CountsResponse(
    val added: Int = 0,
    val removed: Int = 0,
    val changed: Int = 0,
    val unchanged: Int = 0,
)

@Serializable
private data class InUseResponse(val name: String, val sizes: List<Int> = emptyList(), val references: Int = 0)

@Serializable
private data class ReconciliationResponse(
    val resolved: Int = 0,
    val unresolved: Int = 0,
    val unresolvedValues: List<String> = emptyList(),
)

@Serializable
private data class IconCatalogResponse(
    val outcome: String,
    val loadId: String? = null,
    val counts: CountsResponse = CountsResponse(),
    val added: List<String> = emptyList(),
    val removed: List<String> = emptyList(),
    val changed: List<String> = emptyList(),
    val truncated: Boolean = false,
    val removedInUse: List<InUseResponse> = emptyList(),
    val reconciliation: ReconciliationResponse = ReconciliationResponse(),
) {
    fun toReport() = IconCatalogReport(
        outcome = outcome,
        loadId = loadId,
        counts = IconCatalogCounts(counts.added, counts.removed, counts.changed, counts.unchanged),
        added = added,
        removed = removed,
        changed = changed,
        truncated = truncated,
        removedInUse = removedInUse.map { IconInUse(it.name, it.sizes, it.references) },
        reconciliation = IconReconciliation(
            reconciliation.resolved,
            reconciliation.unresolved,
            reconciliation.unresolvedValues,
        ),
    )
}

private val IN_USE_LIST = ListSerializer(InUseResponse.serializer())
