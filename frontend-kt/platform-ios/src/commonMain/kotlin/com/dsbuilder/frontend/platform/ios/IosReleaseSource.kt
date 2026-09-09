package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/** Репозиторий, публикующий релизы iOS-инструмента. */
internal const val IOS_RELEASE_REPOSITORY: String = "salute-developers/plasma-ios"

/** Префикс ассета релиза: бинарь `dsbuilder-ios` и его `ios-api-meta.json`. */
internal const val IOS_RELEASE_ASSET_PREFIX: String = "dsbuilder-ios-cli"

/**
 * Релиз iOS-инструмента в GitHub Releases.
 *
 * Тег и ссылка берутся из API, а не собираются из шаблона: теги релизов — даты
 * (`release-01-09-2026`), последний из них определяет GitHub, а не сортировка строк.
 */
internal class IosReleaseSource(
    private val processRunner: ProcessRunner,
    private val workingDirectory: String,
) {
    /**
     * Возвращает релиз: последний опубликованный либо помеченный тегом [version].
     */
    fun resolve(version: String?): ReleaseRead {
        val path = if (version == null) "releases/latest" else "releases/tags/$version"
        val url = "https://api.github.com/repos/$IOS_RELEASE_REPOSITORY/$path"

        return when (val response = fetch(url)) {
            is FetchRead.Failed -> ReleaseRead.Failed(releaseHint(version, response.message))
            is FetchRead.Body -> parse(response.value, version)
        }
    }

    private fun parse(body: String, version: String?): ReleaseRead {
        val release = releaseObject(body)
            ?: return ReleaseRead.Failed(releaseHint(version, "unexpected response"))
        val tag = release["tag_name"]?.jsonPrimitive?.contentOrNullSafe()
            ?: return ReleaseRead.Failed(releaseHint(version, "the response has no tag_name"))

        return toolAsset(release, tag, version)
    }

    private fun releaseObject(body: String): JsonObject? = try {
        JSON.parseToJsonElement(body) as? JsonObject
    } catch (error: IllegalArgumentException) {
        null
    }

    private fun toolAsset(release: JsonObject, tag: String, version: String?): ReleaseRead {
        val asset = (release["assets"] as? JsonArray).orEmpty()
            .mapNotNull { it as? JsonObject }
            .firstOrNull { it.assetName().startsWith(IOS_RELEASE_ASSET_PREFIX) }
            ?: return ReleaseRead.Failed(
                "Release $tag of $IOS_RELEASE_REPOSITORY has no $IOS_RELEASE_ASSET_PREFIX asset. " +
                    "Install it with --from <path|url> or pick another release with --version <tag>.",
            )

        val downloadUrl = asset["browser_download_url"]?.jsonPrimitive?.contentOrNullSafe()
            ?: return ReleaseRead.Failed(releaseHint(version, "asset of release $tag has no download url"))

        return ReleaseRead.Found(version = tag, downloadUrl = downloadUrl)
    }

    private fun fetch(url: String): FetchRead {
        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = CURL,
                    args = listOf("--fail", "--silent", "--show-error", "--location", url),
                    workingDirectory = workingDirectory,
                    inheritStdio = false,
                ),
            )
        } catch (error: ProcessLaunchException) {
            return FetchRead.Failed("$CURL cannot be started: ${error.message}")
        }

        return if (result.exitCode == 0) {
            FetchRead.Body(result.output)
        } else {
            FetchRead.Failed("$CURL exited with code ${result.exitCode}: ${result.output.trim()}")
        }
    }

    private fun releaseHint(version: String?, reason: String): String {
        val release = version?.let { "release $it" } ?: "the latest release"

        return "Cannot read $release of $IOS_RELEASE_REPOSITORY: $reason."
    }

    private companion object {
        private val JSON = Json { ignoreUnknownKeys = true }
    }
}

/** Результат разрешения релиза. */
internal sealed interface ReleaseRead {
    /**
     * Релиз найден.
     *
     * @property version тег релиза.
     * @property downloadUrl ссылка на ассет с инструментом.
     */
    data class Found(val version: String, val downloadUrl: String) : ReleaseRead

    /**
     * Релиз не разрешён.
     *
     * @property message user-facing объяснение.
     */
    data class Failed(val message: String) : ReleaseRead
}

private sealed interface FetchRead {
    data class Body(val value: String) : FetchRead

    data class Failed(val message: String) : FetchRead
}

/** `content` отдаёт литерал `null` строкой, поэтому пустое значение отсекаем явно. */
private fun JsonPrimitive.contentOrNullSafe(): String? = content.takeIf { it.isNotBlank() && it != "null" }

private fun JsonObject.assetName(): String = get("name")?.jsonPrimitive?.contentOrNullSafe().orEmpty()
