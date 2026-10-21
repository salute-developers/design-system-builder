package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.MultipartFile
import com.dsbuilder.frontend.feature.components.application.PreviewPluginRemoteSource
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** HTTP adapter публикации билда плагина: архив и нормализованная мета одним multipart-запросом. */
internal class HttpPreviewPluginRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : PreviewPluginRemoteSource {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    /**
     * Транспортные отказы Ktor приходят типами конкретных движков (CIO, Darwin, JS) без общего супертипа в
     * `commonMain`: без перехвата недоступный backend ронял бы CLI необработанным исключением.
     */
    @Suppress("TooGenericExceptionCaught")
    override suspend fun publish(command: PublishPreviewPluginRemoteCommand): PublishPreviewPluginRemoteResult {
        val meta = json.encodeToString(
            ApiMetaImportRequest.serializer(),
            command.manifest.toImportRequest(COMPOSE_PLATFORM, command.source, command.dryRun),
        )
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)
        val response = try {
            client.postMultipart(
                "$PATH?dryRun=${command.dryRun}",
                listOf(
                    MultipartFile(PLUGIN_PART, ARCHIVE_NAME, "application/zip", command.archive.zipBytes),
                    MultipartFile(META_PART, META_NAME, "application/json", meta.encodeToByteArray()),
                ),
            )
        } catch (exception: Exception) {
            return PublishPreviewPluginRemoteResult.Failed(transportMessage(exception))
        }
        return map(response)
    }

    private fun map(response: AuthenticatedHttpResponse): PublishPreviewPluginRemoteResult =
        when (response.statusCode) {
            in SUCCESS -> parse(response.body)
            CONFLICT -> PublishPreviewPluginRemoteResult.Conflict(reason(response.body) ?: "Build content changed.")
            UNAUTHORIZED -> PublishPreviewPluginRemoteResult.Failed(
                "Status: unauthorized. Credential is missing or invalid.".withReason(reason(response.body)),
            )
            FORBIDDEN -> PublishPreviewPluginRemoteResult.Failed(
                "Status: forbidden. Credential cannot publish the plugin.".withReason(reason(response.body)),
            )
            else -> PublishPreviewPluginRemoteResult.Failed(
                "Status: failed. Backend returned HTTP ${response.statusCode}: " +
                    (reason(response.body) ?: response.body.lineSequence().firstOrNull().orEmpty().take(MESSAGE_LIMIT)),
            )
        }

    private fun parse(body: String): PublishPreviewPluginRemoteResult = try {
        val dto = json.decodeFromString(PublishPluginBuildResponse.serializer(), body)
        PublishPreviewPluginRemoteResult.Published(
            outcome = dto.outcome,
            buildId = dto.buildId,
            uikitComposeVersion = dto.uikitComposeVersion,
            pluginUrl = dto.pluginUrl,
            report = dto.report.toDomain(),
        )
    } catch (exception: IllegalArgumentException) {
        PublishPreviewPluginRemoteResult.Failed(
            "Error: backend returned a successful status with an unreadable publication report: " +
                "${exception.message ?: "unexpected shape"}.",
        )
    }

    /** Причина отказа из полей `message` и `error` JSON-тела ответа. */
    private fun reason(body: String): String? {
        val root = runCatching { Json.parseToJsonElement(body) }.getOrNull() as? JsonObject ?: return null
        return listOf("message", "error").firstNotNullOfOrNull { field ->
            (root[field] as? JsonPrimitive)?.takeIf { it.isString }?.content
        }?.lineSequence()?.firstOrNull()?.trim()?.takeIf(String::isNotEmpty)?.take(MESSAGE_LIMIT)
    }

    private fun String.withReason(reason: String?): String = if (reason == null) this else "$this Server: $reason"

    private fun transportMessage(exception: Exception): String =
        exception.message?.lineSequence()?.firstOrNull()
            ?.let { "Status: failed. Backend is unreachable: $it" }
            ?: "Status: failed. Backend is unreachable."

    private companion object {
        const val PATH = "/api/admin/compose-preview/plugin-builds"
        const val COMPOSE_PLATFORM = "compose"
        const val PLUGIN_PART = "plugin"
        const val META_PART = "meta"
        const val ARCHIVE_NAME = "preview-compose-plugin.zip"
        const val META_NAME = "meta.json"
        const val CONFLICT = 409
        const val UNAUTHORIZED = 401
        const val FORBIDDEN = 403
        const val MESSAGE_LIMIT = 200
        val SUCCESS = 200..299
    }
}

/** Ответ публикации backend: нужные клиенту поля. */
@Serializable
internal data class PublishPluginBuildResponse(
    val outcome: String,
    val buildId: String,
    val uikitComposeVersion: String,
    val pluginUrl: String,
    val report: ApiMetaImportReportResponse = ApiMetaImportReportResponse(),
)
