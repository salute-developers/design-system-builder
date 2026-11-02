package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.PluginArchiveLimits
import com.dsbuilder.ds.components.application.PluginBuildSettings
import com.dsbuilder.ds.components.application.PluginBuildStorage
import com.dsbuilder.ds.components.data.DisabledPluginBuildStorage
import com.dsbuilder.ds.components.data.S3PluginBuildStorage
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import java.net.URI
import java.time.Duration

/**
 * Настройки хранилища и публикации Compose preview plugin.
 *
 * Без бакета, ключей и публичного адреса хранилище считается ненастроенным: публикация отвечает `503`,
 * выдача адреса плагина отвечает `404`.
 */
data class ComposePreviewPluginConfiguration(
    /** Endpoint S3-совместимого хранилища; пусто для AWS. */
    val endpoint: String? = null,
    /** Регион. */
    val region: String = DEFAULT_REGION,
    /** Бакет плагина. */
    val bucket: String? = null,
    /** Ключ записи. */
    val accessKey: String? = null,
    /** Секрет записи. */
    val secretKey: String? = null,
    /** Адресация path-style (нужна для MinIO). */
    val pathStyle: Boolean = false,
    /** Префикс плагина в бакете. */
    val prefix: String = "",
    /** Публичный адрес префикса плагина без завершающего `/`. */
    val publicBaseUrl: String? = null,
    /** Сколько последних билдов хранить кроме активного. */
    val keepBuilds: Int = PluginBuildSettings.DEFAULT_KEEP_BUILDS,
    /** Через сколько часов файлы без строки в БД считаются осиротевшими. */
    val orphanGraceHours: Long = PluginBuildSettings.DEFAULT_ORPHAN_GRACE.toHours(),
    /** Лимиты архива. */
    val limits: PluginArchiveLimits = PluginArchiveLimits(),
) {
    /** Заданы ли все данные, без которых публикация невозможна. */
    val configured: Boolean
        get() = !bucket.isNullOrBlank() && !accessKey.isNullOrBlank() && !secretKey.isNullOrBlank() &&
            !publicBaseUrl.isNullOrBlank()

    /** Настройки публикации для use case. */
    fun settings() = PluginBuildSettings(
        publicBaseUrl = publicBaseUrl.orEmpty(),
        keepBuilds = keepBuilds,
        orphanGrace = Duration.ofHours(orphanGraceHours),
        limits = limits,
    )

    /** Хранилище плагина либо заглушка, если оно не настроено. */
    fun createStorage(): PluginBuildStorage {
        if (!configured) return DisabledPluginBuildStorage
        val builder = S3Client.builder()
            .region(Region.of(region))
            .credentialsProvider(
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)),
            )
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(pathStyle).build())
            .httpClientBuilder(UrlConnectionHttpClient.builder())
        endpoint?.takeIf(String::isNotBlank)?.let { builder.endpointOverride(URI.create(it)) }
        return S3PluginBuildStorage(builder.build(), requireNotNull(bucket), prefix)
    }

    /** Чтение из переменных окружения. */
    companion object {
        /** Регион по умолчанию. */
        const val DEFAULT_REGION = "us-east-1"

        /** Читает настройки из [environment]; отсутствующие значения оставляют хранилище ненастроенным. */
        fun fromEnvironment(environment: Map<String, String>): ComposePreviewPluginConfiguration {
            fun text(name: String) = environment[name]?.takeIf(String::isNotBlank)
            val defaults = PluginArchiveLimits()
            return ComposePreviewPluginConfiguration(
                endpoint = text("DS_PLUGIN_S3_ENDPOINT"),
                region = text("DS_PLUGIN_S3_REGION") ?: DEFAULT_REGION,
                bucket = text("DS_PLUGIN_S3_BUCKET"),
                accessKey = text("DS_PLUGIN_S3_ACCESS_KEY"),
                secretKey = text("DS_PLUGIN_S3_SECRET_KEY"),
                pathStyle = text("DS_PLUGIN_S3_PATH_STYLE")?.toBooleanStrictOrNull() ?: false,
                prefix = text("DS_PLUGIN_S3_PREFIX").orEmpty(),
                publicBaseUrl = text("DS_PLUGIN_PUBLIC_BASE_URL"),
                keepBuilds = text("DS_PLUGIN_KEEP_BUILDS")?.toIntOrNull()?.takeIf { it >= 0 }
                    ?: PluginBuildSettings.DEFAULT_KEEP_BUILDS,
                orphanGraceHours = text("DS_PLUGIN_ORPHAN_GRACE_HOURS")?.toLongOrNull()?.takeIf { it >= 0 }
                    ?: PluginBuildSettings.DEFAULT_ORPHAN_GRACE.toHours(),
                limits = PluginArchiveLimits(
                    maxCompressedBytes = text("DS_PLUGIN_MAX_COMPRESSED_BYTES")?.toLongOrNull()
                        ?: defaults.maxCompressedBytes,
                    maxUncompressedBytes = text("DS_PLUGIN_MAX_UNCOMPRESSED_BYTES")?.toLongOrNull()
                        ?: defaults.maxUncompressedBytes,
                    maxEntries = text("DS_PLUGIN_MAX_ENTRIES")?.toIntOrNull() ?: defaults.maxEntries,
                    maxEntryBytes = text("DS_PLUGIN_MAX_ENTRY_BYTES")?.toLongOrNull() ?: defaults.maxEntryBytes,
                    maxPathBytes = defaults.maxPathBytes,
                ),
            )
        }
    }
}
