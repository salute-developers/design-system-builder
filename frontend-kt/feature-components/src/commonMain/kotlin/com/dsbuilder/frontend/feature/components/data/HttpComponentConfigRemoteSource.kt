package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CoreReleaseRef
import com.dsbuilder.frontend.core.domain.CoreReleaseSnapshot
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.ReadBoundary
import com.dsbuilder.frontend.feature.components.application.ComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.application.ExportComponentsCommand
import com.dsbuilder.frontend.feature.components.application.ExportComponentsResult
import com.dsbuilder.frontend.feature.components.application.ImportComponentsCommand
import com.dsbuilder.frontend.feature.components.application.ImportComponentsResult
import com.dsbuilder.frontend.feature.components.domain.ComponentImportRejection
import com.dsbuilder.frontend.feature.components.domain.ComponentImportReport
import com.dsbuilder.frontend.feature.components.domain.ExportedComponentConfig
import com.dsbuilder.frontend.feature.components.domain.ExportedComponentPackage
import com.dsbuilder.frontend.feature.components.domain.codec.CommonConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * HTTP adapter обмена конфигурациями компонентов через project-scoped backend API.
 */
internal class HttpComponentConfigRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ComponentConfigRemoteSource {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    override suspend fun import(command: ImportComponentsCommand): ImportComponentsResult {
        val body = json.encodeToString(
            ImportRequest.serializer(),
            ImportRequest(
                platform = command.platform,
                meta = ImportMeta(name = command.packageName, source = command.packageOrigin),
                dryRun = command.dryRun,
                components = command.components.map { component ->
                    ImportComponent(
                        componentName = component.componentName,
                        styleName = component.styleName,
                        config = component.config,
                    )
                },
            ),
        )

        val path = "/api/projects/${command.projectId.value}/design-systems/" +
            "${command.designSystemId.value}/component-config/import"
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)

        return when (val response = client.post(path, body)) {
            is AuthenticatedHttpResult.Failure -> ImportComponentsResult.Failed(response.message)
            is AuthenticatedHttpResult.Success -> parseReport(response.body)
        }
    }

    override suspend fun export(command: ExportComponentsCommand): ExportComponentsResult {
        val body = json.encodeToString(
            ExportRequest.serializer(),
            ExportRequest(platform = command.platform),
        )

        val path = "/api/projects/${command.projectId.value}/design-systems/" +
            "${command.designSystemId.value}/component-config/export" +
            exportVersionQuery(command.version, command.readContext)
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)

        return when (val response = client.post(path, body)) {
            is AuthenticatedHttpResult.Failure -> ExportComponentsResult.Failed(
                if (response.statusCode == 404 && command.credential == BackendCredential.Anonymous) {
                    "Check the link. If access requires authentication, run dsbuilder auth login."
                } else {
                    response.message
                },
            )
            is AuthenticatedHttpResult.Success -> if (!validBoundary(command, response)) {
                ExportComponentsResult.Failed("Error: ambiguous component read context.")
            } else {
                when (val parsed = parsePackage(response.body)) {
                    is ExportComponentsResult.Failed -> parsed
                    is ExportComponentsResult.Exported -> parsed.copy(
                        value = parsed.value.copy(readContext = response.headers["x-ds-read-context"]),
                    )
                }
            }
        }
    }

    private fun validBoundary(command: ExportComponentsCommand, response: AuthenticatedHttpResult.Success): Boolean =
        ReadBoundary.validates(
            response.headers["x-ds-read-context"],
            command.designSystemId.value,
            command.version,
            command.readContext,
            required = command.credential == BackendCredential.Anonymous,
            headersValid = response.readHeadersValid,
        )

    /**
     * Разбирает выгруженный пакет и отказывает целиком, если тело успешного ответа нечитаемо.
     */
    private fun parsePackage(body: String): ExportComponentsResult = try {
        ExportComponentsResult.Exported(
            json.decodeFromString(ExportPackageResponse.serializer(), body).toDomain(),
        )
    } catch (exception: IllegalArgumentException) {
        ExportComponentsResult.Failed(
            "Error: backend returned a successful status with an unreadable component package: " +
                "${exception.message ?: "unexpected shape"}.",
        )
    }

    /**
     * Разбирает отчёт импорта и отказывает целиком, если тело успешного ответа нечитаемо:
     * частичный отчёт ввёл бы в заблуждение сильнее, чем отказ.
     */
    private fun parseReport(body: String): ImportComponentsResult = try {
        ImportComponentsResult.Imported(
            json.decodeFromString(ImportReportResponse.serializer(), body).toDomain(),
        )
    } catch (exception: IllegalArgumentException) {
        ImportComponentsResult.Failed(
            "Error: backend returned a successful status with an unreadable import report: " +
                "${exception.message ?: "unexpected shape"}.",
        )
    }
}

/**
 * Тело запроса `POST /design-systems/${command.designSystemId.value}/component-config/import`.
 *
 * Система определяется путём запроса.
 * backend адресует дизайн-систему телом запроса.
 * @property platform платформа компонентов: имя компонента уникально только внутри платформы.
 * @property meta метаданные пакета.
 * @property dryRun признак импорта без сохранения изменений.
 * @property components конфигурации в common-формате.
 */
@Serializable
private data class ImportRequest(
    val platform: String,
    val meta: ImportMeta,
    val dryRun: Boolean,
    val components: List<ImportComponent>,
)

/**
 * Метаданные пакета в теле запроса.
 *
 * @property name имя из `meta.json`.
 * @property source разрешённый источник пакета.
 */
@Serializable
private data class ImportMeta(
    val name: String,
    val source: String,
)

/**
 * Одна конфигурация в теле запроса.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property config конфигурация в common-формате.
 */
@Serializable
private data class ImportComponent(
    val componentName: String,
    val styleName: String,
    val config: CommonConfig,
)

/**
 * Отчёт импорта в ответе backend.
 */
@Serializable
private data class ImportReportResponse(
    val created: Int = 0,
    val updated: Int = 0,
    val unchanged: Int = 0,
    val rejected: List<ImportRejectionResponse> = emptyList(),
    val unresolvedTokens: List<String> = emptyList(),
    val unresolvedComponentStyles: List<String> = emptyList(),
    val unknownProperties: List<String> = emptyList(),
    val unknownStates: List<String> = emptyList(),
    val typeMismatches: List<String> = emptyList(),
    val gradientOnlyProperties: List<String> = emptyList(),
    val underivableVariationIds: List<String> = emptyList(),
) {
    fun toDomain(): ComponentImportReport = ComponentImportReport(
        created = created,
        updated = updated,
        unchanged = unchanged,
        rejected = rejected.map { it.toDomain() },
        unresolvedTokens = unresolvedTokens,
        unresolvedComponentStyles = unresolvedComponentStyles,
        unknownProperties = unknownProperties,
        unknownStates = unknownStates,
        typeMismatches = typeMismatches,
        gradientOnlyProperties = gradientOnlyProperties,
        underivableVariationIds = underivableVariationIds,
    )
}

/**
 * Отклонённая конфигурация в ответе backend.
 */
@Serializable
private data class ImportRejectionResponse(
    val componentName: String = "",
    val styleName: String = "",
    val reason: String = "",
) {
    fun toDomain(): ComponentImportRejection = ComponentImportRejection(
        componentName = componentName,
        styleName = styleName,
        reason = reason,
    )
}

/**
 * Тело запроса `POST /design-systems/${command.designSystemId.value}/component-config/export`.
 *
 * @property platform платформа компонентов.
 */
@Serializable
private data class ExportRequest(
    val platform: String,
)

/**
 * Тело ответа выгрузки.
 *
 * @property meta имя и версия пакета.
 * @property components выгруженные конфигурации.
 * @property underivedTypes значения, вид заливки которых модель не смогла вывести.
 */
@Serializable
private data class ExportPackageResponse(
    val meta: ExportMetaResponse,
    val components: List<ExportComponentResponse> = emptyList(),
    val underivedTypes: List<String> = emptyList(),
) {
    fun toDomain(): ExportedComponentPackage = ExportedComponentPackage(
        name = meta.name,
        version = meta.version,
        configurations = components.map { component ->
            ExportedComponentConfig(
                componentName = component.componentName,
                styleName = component.styleName,
                config = component.config,
            )
        },
        underivedTypes = underivedTypes,
        coreReleases = meta.coreReleases.map {
            CoreReleaseSnapshot(
                it.releaseId,
                CoreReleaseRef(it.libraryId, it.platform, it.version),
                it.metaSha256,
                it.provenance,
                it.channel,
            )
        },
    )
}

/**
 * Метаданные выгруженного пакета.
 *
 * @property name имя дизайн-системы.
 * @property version версия последней опубликованной записи.
 */
@Serializable
private data class ExportMetaResponse(
    val name: String,
    val version: String,
    val coreReleases: List<ExportCoreRelease> = emptyList(),
)

/**
 * Одна выгруженная конфигурация.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property config конфигурация в common-формате.
 */
@Serializable
private data class ExportComponentResponse(
    val componentName: String,
    val styleName: String,
    val config: CommonConfig,
)

/** Отдельные координаты источника конфигурации. */
@Serializable
private data class ExportCoreRelease(
    val releaseId: String,
    val libraryId: String,
    val platform: String,
    val version: String,
    val metaSha256: String? = null,
    val provenance: String,
    val channel: String? = null,
)

/** Версия из явного DS-link применяется одинаково к конфигурациям и их web-адаптеру. */
internal fun exportVersionQuery(version: String?, readContext: String? = null): String =
    ReadBoundary.parse(readContext)?.query()
        ?: version?.let { "?version=${encodePart(it)}" }.orEmpty()
