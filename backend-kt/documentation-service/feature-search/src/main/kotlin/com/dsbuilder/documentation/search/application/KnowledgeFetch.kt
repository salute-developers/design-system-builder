package com.dsbuilder.documentation.search.application

import kotlinx.serialization.Serializable

/** Parsed deterministic knowledge-base URL. */
data class KnowledgeUrl(
    /** Publication ID. */ val publicationId: String,
    /** Content ID. */ val contentId: String,
    /** Chunk ordinal. */ val ordinal: Int,
) {
    /** Canonical URL representation. */
    val value: String = "dsb://documentation/$publicationId/$contentId/$ordinal"

    /** Parser canonical knowledge-base URL. */
    companion object {
        private val pattern = Regex("^dsb://documentation/([^/]+)/([^/]+)/(0|[1-9][0-9]*)$")

        /** Разбирает URL или возвращает `null` для неканонического значения. */
        fun parse(value: String): KnowledgeUrl? {
            val match = pattern.matchEntire(value) ?: return null
            val ordinal = match.groupValues[3].toIntOrNull() ?: return null
            return KnowledgeUrl(match.groupValues[1], match.groupValues[2], ordinal)
        }
    }
}

/** Full knowledge chunk response with source and publication metadata. */
@Serializable
data class KnowledgeChunkDto(
    /** Deterministic knowledge-base URL. */ val kbUrl: String,
    /** Publication ID. */ val publicationId: String,
    /** Design system ID. */ val designSystemId: String,
    /** Design system version. */ val version: String,
    /** Canonical platform. */ val platform: String,
    /** Page ID. */ val pageId: String,
    /** Normalized page path. */ val pagePath: String,
    /** Page title. */ val pageTitle: String,
    /** Content ID. */ val contentId: String,
    /** Source bundle path. */ val sourcePath: String,
    /** Chunk ordinal. */ val ordinal: Int,
    /** Heading hierarchy. */ val headingPath: List<String>,
    /** Full chunk markdown. */ val markdown: String,
    /** Plain searchable text. */ val searchText: String,
    /** Canonical subjects. */ val subjects: List<String>,
)

/** Port project-scoped knowledge chunk fetch. */
fun interface KnowledgeChunkRepository {
    /** Читает chunk только из published publication trusted project. */
    suspend fun fetch(projectId: String, url: KnowledgeUrl): KnowledgeChunkDto?
}

/** Валидирует URL и делегирует project-scoped fetch. */
class FetchKnowledgeChunkUseCase(private val repository: KnowledgeChunkRepository) {
    /** Возвращает `null` для malformed URL, чужого project и отсутствующего chunk. */
    suspend fun execute(projectId: String, url: String): KnowledgeChunkDto? =
        KnowledgeUrl.parse(url)?.let { repository.fetch(projectId, it) }
}
