package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ApiMetaRemoteSource
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteCommand
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaRejection
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * HTTP adapter загрузки манифеста API-меты через project-scoped backend API.
 */
internal class HttpApiMetaRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ApiMetaRemoteSource {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    override suspend fun import(command: ImportApiMetaRemoteCommand): ImportApiMetaRemoteResult {
        val body = json.encodeToString(
            ApiMetaImportRequest.serializer(),
            ApiMetaImportRequest(
                designSystemId = command.designSystemId.value,
                platform = command.platform,
                meta = ApiMetaImportMeta(source = command.source),
                dryRun = command.dryRun,
                components = command.manifest.components.map { component ->
                    ApiMetaImportComponent(
                        name = component.name,
                        properties = component.properties.map { property ->
                            ApiMetaImportProperty(
                                name = property.name,
                                type = property.type,
                                platformNames = property.platformNames,
                                description = property.description,
                            )
                        },
                        states = component.states,
                    )
                },
            ),
        )

        val path = "/api/projects/${command.projectId.value}/ds/component-config/import-api-meta"
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)

        return when (val response = client.post(path, body)) {
            is AuthenticatedHttpResult.Failure -> ImportApiMetaRemoteResult.Failed(response.message)
            is AuthenticatedHttpResult.Success -> parseReport(response.body)
        }
    }

    /**
     * Разбирает отчёт и отказывает целиком, если тело успешного ответа нечитаемо:
     * частичный отчёт ввёл бы в заблуждение сильнее, чем отказ.
     */
    private fun parseReport(body: String): ImportApiMetaRemoteResult = try {
        ImportApiMetaRemoteResult.Imported(
            json.decodeFromString(ApiMetaImportReportResponse.serializer(), body).toDomain(),
        )
    } catch (exception: IllegalArgumentException) {
        ImportApiMetaRemoteResult.Failed(
            "Error: backend returned a successful status with an unreadable API meta import report: " +
                "${exception.message ?: "unexpected shape"}.",
        )
    }
}

/**
 * Тело запроса `POST /ds/component-config/import-api-meta`.
 *
 * @property designSystemId дизайн-система, к которой привязываются компоненты. Идентификатора нет
 * в пути: backend адресует дизайн-систему телом запроса.
 * @property platform платформа из словаря backend.
 * @property meta метаданные источника.
 * @property dryRun признак импорта без сохранения изменений.
 * @property components компоненты манифеста.
 */
@Serializable
private data class ApiMetaImportRequest(
    val designSystemId: String,
    val platform: String,
    val meta: ApiMetaImportMeta,
    val dryRun: Boolean,
    val components: List<ApiMetaImportComponent>,
)

@Serializable
private data class ApiMetaImportMeta(
    val source: String,
)

@Serializable
private data class ApiMetaImportComponent(
    val name: String,
    val properties: List<ApiMetaImportProperty>,
    val states: List<String>,
)

@Serializable
private data class ApiMetaImportProperty(
    val name: String,
    val type: String,
    val platformNames: List<String>,
    val description: String? = null,
)

/**
 * Отчёт импорта в ответе backend. Все поля необязательны и по умолчанию нулевые.
 */
@Serializable
private data class ApiMetaImportReportResponse(
    val createdComponents: Int = 0,
    val createdProperties: Int = 0,
    val createdStates: Int = 0,
    val createdAliases: Int = 0,
    val createdLinks: Int = 0,
    val unchangedProperties: Int = 0,
    val rejected: List<ApiMetaRejectionResponse> = emptyList(),
    val typeMismatches: List<String> = emptyList(),
) {
    fun toDomain(): ApiMetaImportReport = ApiMetaImportReport(
        createdComponents = createdComponents,
        createdProperties = createdProperties,
        createdStates = createdStates,
        createdAliases = createdAliases,
        createdLinks = createdLinks,
        unchangedProperties = unchangedProperties,
        rejected = rejected.map { ApiMetaRejection(it.component, it.property, it.reason) },
        typeMismatches = typeMismatches,
    )
}

@Serializable
private data class ApiMetaRejectionResponse(
    val component: String = "",
    val property: String = "",
    val reason: String = "",
)
