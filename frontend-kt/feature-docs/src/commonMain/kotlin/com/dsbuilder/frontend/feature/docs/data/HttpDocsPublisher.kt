package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.MultipartFile
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsHttpClient
import com.dsbuilder.frontend.feature.docs.application.DocsUploadRequest
import com.dsbuilder.frontend.feature.docs.application.DocsUploadResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * HTTP-based implementation of DocsHttpClient.
 *
 * Загружает tar.gz bundle через authenticated project-scoped gateway API.
 */
internal class HttpDocsPublisher(
    private val fileSystem: WorkspaceFileSystem,
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : DocsHttpClient {

    @Suppress("ReturnCount")
    override fun uploadBundle(request: DocsUploadRequest): DocsUploadResult {
        val path = fileSystem.absolutePath(request.bundlePath)
        if (!fileSystem.exists(path)) return DocsUploadResult.Failed("Publish failed: Bundle file was not found: $path")
        if (fileSystem.isDirectory(
                path,
            )
        ) {
            return DocsUploadResult.Failed("Publish failed: Bundle path is a directory: $path")
        }
        val bytes = try {
            fileSystem.readBytes(path)
        } catch (_: Exception) {
            return DocsUploadResult.Failed("Publish failed: Cannot read bundle file: $path")
        }
        val response = try {
            httpClientFactory.create(request.apiUrl.value, request.apiKey.value).postMultipart(
                path = "/api/projects/${request.projectId.value}/documentation/bundles",
                file = MultipartFile("bundle", fileName(path), "application/gzip", bytes),
            )
        } catch (_: Exception) {
            return DocsUploadResult.Failed("Publish failed: Documentation upload is unavailable.")
        }
        if (response.statusCode in 200..299) {
            val accepted = decode<AcceptedResponse>(response.body)
                ?: return DocsUploadResult.Failed("Publish failed: Cannot parse accepted response.")
            return DocsUploadResult.Accepted(accepted.bundleId, accepted.jobId, accepted.status)
        }
        val diagnostics = decode<ErrorResponse>(response.body)?.errors.orEmpty()
        val message = if (diagnostics.isEmpty()) {
            "Publish failed: Backend returned HTTP ${response.statusCode}."
        } else {
            diagnostics.joinToString(prefix = "Publish failed: HTTP ${response.statusCode}. ", separator = "; ") {
                listOfNotNull(it.code, it.message, it.path?.let { path -> "path=$path" }).joinToString(": ")
            }
        }
        return DocsUploadResult.Failed(message)
    }

    private inline fun <reified T> decode(body: String): T? = try {
        json.decodeFromString<T>(body)
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }

    private fun fileName(path: String): String = path.replace('\\', '/').substringAfterLast('/')
}

@Serializable
private data class AcceptedResponse(
    val bundleId: String,
    val jobId: String,
    val status: String = "accepted",
)

@Serializable
private data class ErrorResponse(val errors: List<ErrorDiagnostic>)

@Serializable
private data class ErrorDiagnostic(val code: String, val message: String, val path: String? = null)
