package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestEntry
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestRules
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestSource
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/** Результат разбора `icons-manifest.json`. */
internal sealed interface IconManifestDecoding {
    /** Манифест разобран и соответствует формату. */
    data class Valid(val manifest: IconManifest) : IconManifestDecoding

    /** Файл не соответствует формату; [reason] описывает первое нарушение. */
    data class Invalid(val reason: String) : IconManifestDecoding
}

@Serializable
private data class SourceDto(
    @SerialName("package") val packageName: String = "",
    val version: String = "",
)

@Serializable
private data class IconDto(
    val name: String,
    val category: String? = null,
    val aliases: List<String> = emptyList(),
    val sizes: Map<String, String> = emptyMap(),
)

@Serializable
private data class ManifestDto(
    val schemaVersion: Int = 0,
    val source: SourceDto = SourceDto(),
    val icons: List<IconDto> = emptyList(),
)

/** JSON-форма манифеста: общая для файла `icons-manifest.json` и тела запроса на бэкенд. */
internal object IconManifestJson {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    /** Кодирует манифест в JSON формата `schemaVersion` 1. */
    fun encode(manifest: IconManifest): String = json.encodeToString(
        ManifestDto.serializer(),
        ManifestDto(
            schemaVersion = IconManifestRules.SCHEMA_VERSION,
            source = SourceDto(manifest.source.packageName, manifest.source.version),
            icons = manifest.icons.map { icon ->
                IconDto(
                    name = icon.name,
                    category = icon.category,
                    aliases = icon.aliases,
                    sizes = icon.sizes.entries.sortedBy { it.key }.associate { it.key.toString() to it.value },
                )
            },
        ),
    )

    /** Разбирает и проверяет манифест: формат, имена, размеры и размер каждого SVG. */
    @Suppress("ReturnCount")
    fun decode(text: String): IconManifestDecoding {
        val dto = try {
            json.decodeFromString(ManifestDto.serializer(), text)
        } catch (exception: SerializationException) {
            return IconManifestDecoding.Invalid("it is not a valid icons manifest (${exception.reason()})")
        } catch (exception: IllegalArgumentException) {
            return IconManifestDecoding.Invalid("it is not a valid icons manifest (${exception.reason()})")
        }
        if (dto.schemaVersion != IconManifestRules.SCHEMA_VERSION) {
            return IconManifestDecoding.Invalid(
                "schemaVersion is ${dto.schemaVersion}, expected ${IconManifestRules.SCHEMA_VERSION}",
            )
        }
        if (dto.icons.isEmpty()) return IconManifestDecoding.Invalid("it contains no icons")
        val icons = dto.icons.map { icon ->
            toEntry(icon) ?: return IconManifestDecoding.Invalid(invalidIcon(icon))
        }
        val duplicate = icons.groupBy { it.name }.filterValues { it.size > 1 }.keys.firstOrNull()
        if (duplicate != null) return IconManifestDecoding.Invalid("icon '$duplicate' is listed twice")
        return IconManifestDecoding.Valid(
            IconManifest(
                IconManifestSource(
                    packageName = dto.source.packageName.ifEmpty { IconManifestRules.PACKAGE_NAME },
                    version = dto.source.version.ifEmpty { IconManifestRules.UNKNOWN_VERSION },
                ),
                icons.sortedBy { it.name },
            ),
        )
    }

    private fun toEntry(dto: IconDto): IconManifestEntry? {
        val sizes = dto.sizes.entries.associate { (key, svg) ->
            val valid = svg.isNotEmpty() && svg.encodeToByteArray().size <= IconManifestRules.MAX_SVG_BYTES
            val size = key.toIntOrNull()?.takeIf { it in IconManifestRules.SIZES && valid }
            (size ?: INVALID_SIZE) to svg
        }
        val valid = IconManifestRules.NAME.matches(dto.name) && sizes.isNotEmpty() && INVALID_SIZE !in sizes
        return if (valid) IconManifestEntry(dto.name, dto.category, dto.aliases, sizes) else null
    }

    private fun invalidIcon(dto: IconDto): String = when {
        !IconManifestRules.NAME.matches(dto.name) -> "icon name '${dto.name}' is not valid"
        dto.sizes.isEmpty() -> "icon '${dto.name}' has no sizes"
        else ->
            "icon '${dto.name}' has an unknown size or an empty or oversized SVG " +
                "(sizes ${IconManifestRules.SIZES.joinToString("/")}, at most ${IconManifestRules.MAX_SVG_BYTES} bytes)"
    }

    private fun Exception.reason(): String = message?.lineSequence()?.firstOrNull().orEmpty().take(REASON_LIMIT)

    private const val REASON_LIMIT = 160
    private const val INVALID_SIZE = -1
}
