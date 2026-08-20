package com.dsbuilder.documentation.search.application

import com.dsbuilder.documentation.publication.domain.CanonicalLexicalNormalizer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Project-scoped search request. */
data class DocumentationSearchRequest(
    /** Trusted project ID. */ val projectId: String,
    /** Design system ID. */ val designSystemId: String,
    /** Design system version. */ val version: String,
    /** Canonical platform. */ val platform: String,
    /** Literal поисковый запрос. */ val query: String,
    /** Optional canonical subjects OR filter. */ val subjects: Set<String> = emptySet(),
    /** Offset cursor. */ val cursor: Int = 0,
    /** Page size. */ val limit: Int = 20,
)

/** Canonical representations одного literal query. */
data class LexicalSearchQuery(
    /** Exact representation со значимой punctuation. */ val exact: String,
    /** Token representation для identifiers и FTS. */ val tokens: List<String>,
) {
    /** Space-separated tokens. */ val tokenText: String = tokens.joinToString(" ")

    companion object {
        /** Нормализует raw query единым publication/search contract. */
        fun from(raw: String): LexicalSearchQuery? = CanonicalLexicalNormalizer.normalize(raw)?.let {
            LexicalSearchQuery(it.exact, it.tokens)
        }
    }
}

/** Stable structured match strength от наиболее сильного к слабому. */
enum class StructuredMatchKind {
    EXACT_REFERENCE,
    EXACT_SUBJECT_OR_NAME,
    EXACT_OTHER_TERM,
    PREFIX,
    TRIGRAM,
}

/** Независимый PostgreSQL markdown channel. */
enum class MarkdownSearchChannel { TECHNICAL, RUSSIAN, ENGLISH }

/** Stable affinity query к markdown page title. */
enum class MarkdownTitleMatch { EXACT, TOKEN_SUFFIX, TOKENS, NONE }

/** Versioned default lexical ranking profile и hard operational bounds. */
data class LexicalRankingProfile(
    /** Версия ranking/eval contract. */ val version: String = "lexical-v2",
    /** Hard limit на каждый repository channel. */ val channelCandidateLimit: Int = 200,
    /** Hard limit общего fusion window. */ val totalCandidateLimit: Int = 500,
    /** Минимальная длина exact query для trigram. */ val fuzzyMinimumLength: Int = 5,
    /** PostgreSQL pg_trgm similarity threshold. */ val fuzzyThreshold: Double = 0.45,
    /** Reciprocal-rank constant. */ val rrfConstant: Int = 60,
    /** Prefix channel weight. */ val prefixWeight: Double = 0.75,
    /** Trigram channel weight. */ val trigramWeight: Double = 0.60,
    /** Technical FTS channel weight. */ val technicalWeight: Double = 1.0,
    /** Russian FTS channel weight. */ val russianWeight: Double = 0.95,
    /** English FTS channel weight. */ val englishWeight: Double = 0.95,
    /** Максимальное число Unicode code points snippet. */ val snippetLength: Int = 300,
    /** Контекст до lexical match. */ val snippetContext: Int = 120,
)

/** Structured search candidate с explainable evidence. */
data class StructuredSearchHit(
    /** CodeBinding ID. */ val codeBindingId: String,
    /** Canonical subject. */ val subject: String,
    /** Binding kind. */ val kind: String,
    /** Binding name. */ val name: String,
    /** Термин, совпавший с запросом. */ val matchedTerm: String,
    /** Stable term category. */ val termType: String,
    /** Категория совпадения для ranking. */ val match: StructuredMatchKind,
    /** Database evidence внутри одного channel. */ val rank: Double = 1.0,
)

/** Markdown FTS candidate. */
data class MarkdownSearchHit(
    /** Deterministic knowledge-base URL. */ val kbUrl: String,
    /** Page title. */ val title: String,
    /** Safe match-centered plain-text snippet. */ val snippet: String,
    /** Normalized page path. */ val pagePath: String,
    /** Canonical subjects. */ val subjects: List<String>,
    /** PostgreSQL FTS rank, не являющийся API contract. */ val rank: Double,
    /** Канал, давший hit. */ val channel: MarkdownSearchChannel,
    /** Поля с lexical evidence. */ val matchedFields: Set<String>,
    /** Сила совпадения с canonical page title. */ val titleMatch: MarkdownTitleMatch = MarkdownTitleMatch.NONE,
)

/** Port active publication lookup. */
fun interface ActivePublicationResolver {
    /** Возвращает ID только active published publication trusted project. */
    suspend fun resolve(projectId: String, designSystemId: String, version: String, platform: String): String?
}

/** Port PostgreSQL structured и FTS channels. */
interface DocumentationSearchIndex {
    /** Ищет exact, prefix и bounded trigram structured совпадения. */
    suspend fun structured(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<StructuredSearchHit>

    /** Ищет chunks по technical, Russian и English FTS. */
    suspend fun markdown(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<MarkdownSearchHit>
}

/** Low-cardinality telemetry без raw query и tenant identifiers. */
fun interface DocumentationSearchMetrics {
    /** Записывает один агрегируемый search observation. */
    fun record(observation: SearchObservation)
}

/** Безопасные operational search dimensions. */
data class SearchObservation(
    /** End-to-end latency. */ val latencyMillis: Long,
    /** Число bounded candidates. */ val candidateCount: Int,
    /** Число результатов page. */ val resultCount: Int,
    /** Признак пустой выдачи. */ val zeroResult: Boolean,
    /** Низкокардинальные match channels результата. */ val matchChannels: Set<String>,
)

/** Combined search outcome. */
sealed interface DocumentationSearchOutcome {
    /** Query не содержит searchable exact value или tokens. */
    data object InvalidQuery : DocumentationSearchOutcome

    /** Active publication не найдена в trusted project. */
    data object PublicationNotFound : DocumentationSearchOutcome

    /** Успешная search page. */
    data class Found(
        /** Страница результатов. */ val page: DocumentationSearchPage,
    ) : DocumentationSearchOutcome
}

/** Cursor page discriminated results. */
@Serializable
data class DocumentationSearchPage(
    /** Results в deterministic порядке. */ val items: List<DocumentationSearchResultDto>,
    /** Следующий offset cursor. */ val nextCursor: Int?,
)

/** Explicit backward-compatible discriminated result. */
@Serializable
sealed interface DocumentationSearchResultDto {
    /** Structured CodeBinding search result. */
    @Serializable
    @SerialName("code-binding")
    data class CodeBinding(
        /** CodeBinding ID. */
        val codeBindingId: String,
        /** Canonical subject. */
        val subject: String,
        /** Binding kind. */
        val kind: String,
        /** Binding name. */
        val name: String,
        /** Термин, совпавший с запросом. */
        val matchedTerm: String,
        /** Explainable exact/prefix/trigram match. */ val matchType: String? = null,
        /** Stable lookup term category. */ val termType: String? = null,
    ) : DocumentationSearchResultDto

    /** Markdown knowledge chunk search result. */
    @Serializable
    @SerialName("markdown")
    data class Markdown(
        /** Deterministic knowledge URL. */
        val kbUrl: String,
        /** Page title. */
        val title: String,
        /** Safe plain-text snippet. */
        val snippet: String,
        /** Normalized page path. */
        val pagePath: String,
        /** Canonical subjects. */
        val subjects: List<String>,
        /** Legacy PostgreSQL rank; consumers не должны сравнивать его между channels. */ val rank: Double,
        /** Strongest lexical channel. */ val matchType: String? = null,
        /** Поля, содержащие lexical evidence. */ val matchedFields: List<String> = emptyList(),
    ) : DocumentationSearchResultDto
}

/** Объединяет exact tiers и остальные lexical channels через weighted RRF. */
class SearchDocumentationUseCase(
    private val publications: ActivePublicationResolver,
    private val index: DocumentationSearchIndex,
    private val profile: LexicalRankingProfile = LexicalRankingProfile(),
    private val metrics: DocumentationSearchMetrics = DocumentationSearchMetrics { },
) {
    /** Выполняет поиск только по active publication и применяет stable cursor pagination. */
    suspend fun execute(request: DocumentationSearchRequest): DocumentationSearchOutcome {
        val started = System.nanoTime()
        val query = LexicalSearchQuery.from(request.query) ?: return DocumentationSearchOutcome.InvalidQuery
        val publicationId = publications.resolve(
            request.projectId, request.designSystemId, request.version, request.platform,
        ) ?: return DocumentationSearchOutcome.PublicationNotFound
        val candidateLimit = profile.channelCandidateLimit
        val structured = index.structured(publicationId, query, request.subjects, candidateLimit, profile)
        val markdown = index.markdown(publicationId, query, request.subjects, candidateLimit, profile)
        val ranked = rank(structured, markdown).take(profile.totalCandidateLimit)
        val items = ranked.drop(request.cursor).take(request.limit)
        val next = (request.cursor + items.size).takeIf { it < ranked.size }
        metrics.record(
            SearchObservation(
                latencyMillis = (System.nanoTime() - started) / NANOS_PER_MILLISECOND,
                candidateCount = structured.size + markdown.size,
                resultCount = items.size,
                zeroResult = items.isEmpty(),
                matchChannels = items.mapTo(mutableSetOf(), DocumentationSearchResultDto::matchChannel),
            ),
        )
        return DocumentationSearchOutcome.Found(DocumentationSearchPage(items, next))
    }

    private fun rank(
        structured: List<StructuredSearchHit>,
        markdown: List<MarkdownSearchHit>,
    ): List<DocumentationSearchResultDto> {
        val exact = structured
            .filter { it.match in EXACT_MATCHES }
            .groupBy(StructuredSearchHit::codeBindingId)
            .map { (_, hits) -> hits.minWith(structuredEvidenceComparator) }
            .sortedWith(structuredEvidenceComparator.thenBy(StructuredSearchHit::stableId))
        val exactIds = exact.mapTo(mutableSetOf(), StructuredSearchHit::codeBindingId)
        val weakStructured = structured.filter { it.codeBindingId !in exactIds && it.match !in EXACT_MATCHES }
        val titlePriority = markdown
            .filter { it.titleMatch in PRIORITY_TITLE_MATCHES }
            .groupBy(MarkdownSearchHit::kbUrl)
            .values
            .sortedWith(
                compareBy<List<MarkdownSearchHit>> { hits -> hits.minOf { it.titleMatch.ordinal } }
                    .thenByDescending { hits -> hits.maxOf { it.rank } }
                    .thenBy { hits -> hits.first().kbUrl },
            )
        val titlePriorityUrls = titlePriority.mapTo(mutableSetOf()) { it.first().kbUrl }
        val weakMarkdown = markdown.filter { it.kbUrl !in titlePriorityUrls }
        val scores = mutableMapOf<ResultKey, Double>()
        val evidence = mutableMapOf<ResultKey, Any>()

        StructuredMatchKind.entries.filter { it !in EXACT_MATCHES }.forEach { match ->
            addRrf(
                weakStructured.filter { it.match == match }.sortedWith(
                    compareByDescending<StructuredSearchHit> { it.rank }.thenBy(StructuredSearchHit::stableId),
                ),
                weight(match),
                scores,
                evidence,
                { ResultKey("code-binding", it.codeBindingId) },
            )
        }
        MarkdownSearchChannel.entries.forEach { channel ->
            addRrf(
                weakMarkdown.filter { it.channel == channel }.sortedWith(
                    compareByDescending<MarkdownSearchHit> { it.rank }.thenBy(MarkdownSearchHit::kbUrl),
                ),
                weight(channel),
                scores,
                evidence,
                { ResultKey("markdown", it.kbUrl) },
            )
        }

        val fused = scores.keys.sortedWith(
            compareByDescending<ResultKey> { scores.getValue(it) }.thenBy(ResultKey::stable),
        ).map { key ->
            when (val hit = evidence.getValue(key)) {
                is StructuredSearchHit -> hit.toDto()
                is MarkdownSearchHit -> weakMarkdown.filter { it.kbUrl == hit.kbUrl }.toMarkdownDto()
                else -> error("Unsupported lexical evidence")
            }
        }
        return exact.map(StructuredSearchHit::toDto) + titlePriority.map(List<MarkdownSearchHit>::toMarkdownDto) + fused
    }

    private fun <T : Any> addRrf(
        hits: List<T>,
        weight: Double,
        scores: MutableMap<ResultKey, Double>,
        evidence: MutableMap<ResultKey, Any>,
        keyOf: (T) -> ResultKey,
    ) {
        hits.forEachIndexed { index, hit ->
            val key = keyOf(hit)
            scores[key] = scores.getOrDefault(key, 0.0) + weight / (profile.rrfConstant + index + 1)
            val current = evidence[key]
            if (current == null || stronger(hit, current)) evidence[key] = hit
        }
    }

    private fun stronger(candidate: Any, current: Any): Boolean = when {
        candidate is StructuredSearchHit && current is StructuredSearchHit ->
            structuredEvidenceComparator.compare(candidate, current) < 0
        candidate is MarkdownSearchHit && current is MarkdownSearchHit ->
            candidate.titleMatch.ordinal < current.titleMatch.ordinal ||
                (candidate.titleMatch == current.titleMatch && candidate.rank > current.rank)
        else -> false
    }

    private fun weight(match: StructuredMatchKind) = when (match) {
        StructuredMatchKind.PREFIX -> profile.prefixWeight
        StructuredMatchKind.TRIGRAM -> profile.trigramWeight
        else -> 0.0
    }

    private fun weight(channel: MarkdownSearchChannel) = when (channel) {
        MarkdownSearchChannel.TECHNICAL -> profile.technicalWeight
        MarkdownSearchChannel.RUSSIAN -> profile.russianWeight
        MarkdownSearchChannel.ENGLISH -> profile.englishWeight
    }
}

private fun StructuredSearchHit.toDto() = DocumentationSearchResultDto.CodeBinding(
    codeBindingId,
    subject,
    kind,
    name,
    matchedTerm,
    match.apiName(),
    termType,
)

private fun List<MarkdownSearchHit>.toMarkdownDto(): DocumentationSearchResultDto.Markdown {
    val strongest = maxWith(compareBy<MarkdownSearchHit> { it.rank }.thenBy { it.channel.ordinal })
    val titleEvidence = minBy(MarkdownSearchHit::titleMatch).titleMatch.takeUnless { it == MarkdownTitleMatch.NONE }
    return DocumentationSearchResultDto.Markdown(
        strongest.kbUrl,
        strongest.title,
        strongest.snippet,
        strongest.pagePath,
        strongest.subjects,
        strongest.rank,
        titleEvidence?.apiName() ?: strongest.channel.apiName(),
        (flatMapTo(sortedSetOf()) { it.matchedFields } + listOfNotNull("title".takeIf { titleEvidence != null }))
            .distinct().sorted(),
    )
}

private fun StructuredMatchKind.apiName() = name.lowercase().replace('_', '-')
private fun MarkdownSearchChannel.apiName() = "fts-${name.lowercase()}"
private fun MarkdownTitleMatch.apiName() = "title-${name.lowercase().replace('_', '-')}"
private fun StructuredSearchHit.stableId() = "$subject:$codeBindingId:$matchedTerm"
private fun DocumentationSearchResultDto.matchChannel() = when (this) {
    is DocumentationSearchResultDto.CodeBinding -> matchType ?: "structured"
    is DocumentationSearchResultDto.Markdown -> matchType ?: "markdown"
}

private data class ResultKey(val type: String, val id: String) {
    fun stable() = "$type:$id"
}

private val EXACT_MATCHES = setOf(
    StructuredMatchKind.EXACT_REFERENCE,
    StructuredMatchKind.EXACT_SUBJECT_OR_NAME,
    StructuredMatchKind.EXACT_OTHER_TERM,
)
private val PRIORITY_TITLE_MATCHES = setOf(MarkdownTitleMatch.EXACT, MarkdownTitleMatch.TOKEN_SUFFIX)
private val structuredEvidenceComparator = compareBy<StructuredSearchHit> { it.match.ordinal }
    .thenByDescending { it.rank }
    .thenBy(StructuredSearchHit::stableId)
private const val NANOS_PER_MILLISECOND = 1_000_000L
