package com.dsbuilder.documentation.search.data

import com.dsbuilder.documentation.publication.domain.CanonicalLexicalNormalizer
import com.dsbuilder.documentation.search.application.ActivePublicationResolver
import com.dsbuilder.documentation.search.application.DocumentationSearchIndex
import com.dsbuilder.documentation.search.application.KnowledgeChunkDto
import com.dsbuilder.documentation.search.application.KnowledgeChunkRepository
import com.dsbuilder.documentation.search.application.KnowledgeUrl
import com.dsbuilder.documentation.search.application.LexicalRankingProfile
import com.dsbuilder.documentation.search.application.LexicalSearchQuery
import com.dsbuilder.documentation.search.application.MarkdownSearchChannel
import com.dsbuilder.documentation.search.application.MarkdownSearchHit
import com.dsbuilder.documentation.search.application.MarkdownTitleMatch
import com.dsbuilder.documentation.search.application.StructuredMatchKind
import com.dsbuilder.documentation.search.application.StructuredSearchHit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.json.jsonb

/** Exposed repository active publication, structured/FTS search и knowledge fetch. */
class ExposedDocumentationSearchRepository(private val database: Database) :
    ActivePublicationResolver,
    DocumentationSearchIndex,
    KnowledgeChunkRepository {
    override suspend fun resolve(
        projectId: String,
        designSystemId: String,
        version: String,
        platform: String,
    ): String? = query {
        ActivePublications.innerJoin(Publications)
            .select(ActivePublications.publicationId)
            .where {
                (ActivePublications.projectId eq projectId) and
                    (ActivePublications.designSystemId eq designSystemId) and
                    (ActivePublications.version eq version) and
                    (ActivePublications.platform eq platform) and
                    (Publications.status eq PUBLISHED)
            }
            .singleOrNull()?.get(ActivePublications.publicationId)
    }

    override suspend fun structured(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<StructuredSearchHit> = query {
        val subjectSql = subjectPredicate("b.subject", subjects)
        val lexical = exec(
            structuredLexicalSql(subjectSql),
            lexicalArgs(publicationId, query, subjects, candidateLimit),
        ) { rows -> rows.toStructuredHits() }.orEmpty()
        if (query.exact.codePointCount(0, query.exact.length) < profile.fuzzyMinimumLength) {
            return@query lexical.deduplicateStructured(candidateLimit)
        }
        exec(
            "SELECT set_config('pg_trgm.similarity_threshold', ?, true)",
            listOf(TextColumnType() to profile.fuzzyThreshold.toString()),
        ) { }
        val trigramArgs = mutableListOf<Pair<org.jetbrains.exposed.v1.core.IColumnType<*>, Any?>>()
        trigramArgs += TextColumnType() to query.exact
        trigramArgs += VarCharColumnType(80) to publicationId
        trigramArgs += TextColumnType() to query.exact
        subjects.forEach { trigramArgs += TextColumnType() to it }
        trigramArgs += IntegerColumnType() to candidateLimit
        val trigram = exec(
            structuredTrigramSql(subjectSql),
            trigramArgs,
        ) { rows -> rows.toStructuredHits() }.orEmpty()
        (lexical + trigram).deduplicateStructured(candidateLimit)
    }

    override suspend fun markdown(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<MarkdownSearchHit> = query {
        MarkdownChannelSql.entries.flatMap { channel ->
            val subjectSql = subjectPredicate("k.subjects", subjects, jsonb = true)
            val args = mutableListOf<Pair<org.jetbrains.exposed.v1.core.IColumnType<*>, Any?>>()
            if (channel == MarkdownChannelSql.TECHNICAL) args += TextColumnType() to query.exact
            args += TextColumnType() to query.tokenText
            args += VarCharColumnType(80) to publicationId
            subjects.forEach { args += TextColumnType() to it }
            args += IntegerColumnType() to candidateLimit
            exec(
                """
                    WITH literal_query AS (SELECT ${channel.queryExpression()} AS q)
                    SELECT k.kb_url, k.page_title, k.search_text, k.subjects::text, p.path,
                           ts_rank_cd(k.${channel.vector}, q, 32)::double precision AS rank,
                           ts_headline(
                             '${channel.configuration}', k.search_text, q,
                             'StartSel=<lex>, StopSel=</lex>, MaxFragments=1, MinWords=12, MaxWords=40'
                           ) AS headline,
                           concat_ws(',',
                             CASE WHEN to_tsvector('${channel.configuration}', k.page_title) @@ q THEN 'title' END,
                             CASE WHEN to_tsvector('${channel.configuration}', k.heading_path::text) @@ q THEN 'headings' END,
                             CASE WHEN to_tsvector('${channel.configuration}', k.search_text) @@ q THEN 'body' END,
                             CASE WHEN '${channel.configuration}' = 'simple' AND
                               to_tsvector('simple', k.source_path || ' ' || k.code_text || ' ' || k.subjects::text) @@ q
                               THEN 'technical' END
                           ) AS matched_fields
                    FROM knowledge_chunks k
                    JOIN documentation_pages p ON p.id = k.page_id
                    CROSS JOIN literal_query
                    WHERE k.publication_id = ? AND k.${channel.vector} @@ q
                      $subjectSql
                    ORDER BY rank DESC, k.kb_url
                    LIMIT ?
                """.trimIndent(),
                args,
                explicitStatementType = StatementType.SELECT,
            ) { rows ->
                rows.toMarkdownHits(query, profile, channel.channel)
            }.orEmpty()
        }
    }

    override suspend fun fetch(projectId: String, url: KnowledgeUrl): KnowledgeChunkDto? = query {
        KnowledgeChunks.innerJoin(Pages)
            .join(Publications, JoinType.INNER, KnowledgeChunks.publicationId, Publications.id)
            .select(
                KnowledgeChunks.columns +
                    Pages.path +
                    Publications.designSystemId +
                    Publications.version +
                    Publications.platform,
            )
            .where {
                (KnowledgeChunks.publicationId eq url.publicationId) and
                    (KnowledgeChunks.contentId eq url.contentId) and
                    (KnowledgeChunks.ordinal eq url.ordinal) and
                    (KnowledgeChunks.kbUrl eq url.value) and
                    (Publications.projectId eq projectId) and
                    (Publications.status eq PUBLISHED)
            }
            .singleOrNull()?.let { row ->
                KnowledgeChunkDto(
                    kbUrl = row[KnowledgeChunks.kbUrl],
                    publicationId = row[KnowledgeChunks.publicationId],
                    designSystemId = row[Publications.designSystemId],
                    version = row[Publications.version],
                    platform = row[Publications.platform],
                    pageId = row[KnowledgeChunks.pageId],
                    pagePath = row[Pages.path],
                    pageTitle = row[KnowledgeChunks.pageTitle],
                    contentId = row[KnowledgeChunks.contentId],
                    sourcePath = row[KnowledgeChunks.sourcePath],
                    ordinal = row[KnowledgeChunks.ordinal],
                    headingPath = row[KnowledgeChunks.headingPath].strings(),
                    markdown = row[KnowledgeChunks.markdown],
                    searchText = row[KnowledgeChunks.searchText],
                    subjects = row[KnowledgeChunks.subjects].strings(),
                )
            }
    }

    private suspend fun <T> query(block: JdbcTransaction.() -> T): T =
        withContext(Dispatchers.IO) { transaction(database) { block() } }
}

private fun structuredLexicalSql(subjectSql: String): String =
    """
        SELECT id, subject, kind, name, original, category, strength, evidence
        FROM (
            SELECT candidates.*, row_number() OVER (
                PARTITION BY id ORDER BY strength, normalized, original, category
            ) AS logical_rank
            FROM (
                SELECT b.id, b.subject, b.kind, b.name, t.original, t.category, t.normalized,
                       CASE
                         WHEN t.normalized = ? AND t.category IN ('reference', 'theme-reference') THEN 0
                         WHEN t.normalized = ? AND t.category IN ('subject', 'name') THEN 1
                         WHEN t.normalized = ? THEN 2
                         ELSE 3
                       END AS strength,
                       1.0::double precision AS evidence
                FROM (
                    SELECT *
                    FROM structured_lookup_terms
                    WHERE publication_id = ? AND normalized LIKE ? ESCAPE E'\\'
                    UNION ALL
                    SELECT *
                    FROM structured_lookup_terms
                    WHERE publication_id = ? AND tokenized LIKE ? ESCAPE E'\\'
                ) t
                JOIN code_bindings b ON b.id = t.code_binding_id
                WHERE true $subjectSql
            ) candidates
        ) logical_candidates
        WHERE logical_rank = 1
        ORDER BY strength, normalized, subject, id
        LIMIT ?
    """.trimIndent()

private fun structuredTrigramSql(subjectSql: String): String =
    """
        SELECT id, subject, kind, name, original, category, strength, evidence
        FROM (
            SELECT candidates.*, row_number() OVER (
                PARTITION BY id ORDER BY evidence DESC, normalized, original, category
            ) AS logical_rank
            FROM (
                SELECT b.id, b.subject, b.kind, b.name, t.original, t.category, t.normalized,
                       4 AS strength, similarity(t.normalized, ?) AS evidence
                FROM structured_lookup_terms t
                JOIN code_bindings b ON b.id = t.code_binding_id
                WHERE t.publication_id = ? AND t.normalized % ?
                  $subjectSql
            ) candidates
        ) logical_candidates
        WHERE logical_rank = 1
        ORDER BY evidence DESC, normalized, subject, id
        LIMIT ?
    """.trimIndent()

private fun java.sql.ResultSet.toStructuredHits() = buildList {
    while (next()) {
        add(
            StructuredSearchHit(
                codeBindingId = getString("id"),
                subject = getString("subject"),
                kind = getString("kind"),
                name = getString("name"),
                matchedTerm = getString("original"),
                termType = getString("category"),
                match = StructuredMatchKind.entries[getInt("strength")],
                rank = getDouble("evidence"),
            ),
        )
    }
}

private fun java.sql.ResultSet.toMarkdownHits(
    query: LexicalSearchQuery,
    profile: LexicalRankingProfile,
    channel: MarkdownSearchChannel,
) = buildList {
    while (next()) {
        val headline = getString("headline") ?: getString("search_text")
        val title = getString("page_title")
        val titleMatch = classifyTitleMatch(title, query)
        add(
            MarkdownSearchHit(
                kbUrl = getString("kb_url"),
                title = title,
                snippet = matchCenteredSnippet(headline, query.tokens, profile),
                pagePath = getString("path"),
                subjects = Json.parseToJsonElement(getString("subjects")).strings(),
                rank = getDouble("rank"),
                channel = channel,
                matchedFields = getString("matched_fields").split(',').filter(String::isNotBlank).toSet() +
                    listOfNotNull("title".takeIf { titleMatch != MarkdownTitleMatch.NONE }),
                titleMatch = titleMatch,
            ),
        )
    }
}

private fun List<StructuredSearchHit>.deduplicateStructured(candidateLimit: Int): List<StructuredSearchHit> =
    groupBy(StructuredSearchHit::codeBindingId).map { (_, hits) ->
        hits.sortedWith(
            compareBy<StructuredSearchHit> { it.match.ordinal }
                .thenByDescending { it.rank }
                .thenBy { it.matchedTerm }
                .thenBy { it.codeBindingId },
        ).first()
    }.sortedWith(
        compareBy<StructuredSearchHit> { it.match.ordinal }
            .thenByDescending { it.rank }
            .thenBy { it.subject }
            .thenBy { it.codeBindingId },
    ).take(candidateLimit)

private fun lexicalArgs(
    publicationId: String,
    query: LexicalSearchQuery,
    subjects: Set<String>,
    candidateLimit: Int,
): List<Pair<org.jetbrains.exposed.v1.core.IColumnType<*>, Any?>> = buildList {
    add(TextColumnType() to query.exact)
    add(TextColumnType() to query.exact)
    add(TextColumnType() to query.exact)
    add(VarCharColumnType(80) to publicationId)
    add(TextColumnType() to literalPrefixPattern(query.exact))
    add(VarCharColumnType(80) to publicationId)
    add(TextColumnType() to literalPrefixPattern(query.tokenText))
    subjects.forEach { add(TextColumnType() to it) }
    add(IntegerColumnType() to candidateLimit)
}

private fun literalPrefixPattern(value: String): String = buildString(value.length + 1) {
    value.forEach { character ->
        if (character == '\\' || character == '%' || character == '_') append('\\')
        append(character)
    }
    append('%')
}

private fun subjectPredicate(column: String, subjects: Set<String>, jsonb: Boolean = false): String {
    if (subjects.isEmpty()) return ""
    val placeholders = subjects.joinToString(",") { "?" }
    return if (jsonb) {
        "AND EXISTS (SELECT 1 FROM jsonb_array_elements_text($column) subject WHERE subject IN ($placeholders))"
    } else {
        "AND $column IN ($placeholders)"
    }
}

private fun matchCenteredSnippet(
    source: String,
    tokens: List<String>,
    profile: LexicalRankingProfile,
): String {
    val plain = source.replace(HTML_LIKE_TAG, " ").replace(WHITESPACE, " ").trim()
    if (plain.isEmpty()) return plain
    val lowered = plain.lowercase()
    val match = tokens.map { lowered.indexOf(it) }.filter { it >= 0 }.minOrNull() ?: 0
    val start = (match - profile.snippetContext).coerceAtLeast(0)
    val safeStart = if (start > 0 && Character.isLowSurrogate(plain[start])) start - 1 else start
    val end = (safeStart + profile.snippetLength).coerceAtMost(plain.length)
    val safeEnd = if (end < plain.length && Character.isHighSurrogate(plain[end - 1])) end - 1 else end
    return buildString {
        if (safeStart > 0) append('…')
        append(plain.substring(safeStart, safeEnd))
        if (safeEnd < plain.length) append('…')
    }
}

private fun classifyTitleMatch(title: String, query: LexicalSearchQuery): MarkdownTitleMatch {
    val canonical = CanonicalLexicalNormalizer.normalize(title) ?: return MarkdownTitleMatch.NONE
    return when {
        canonical.exact == query.exact -> MarkdownTitleMatch.EXACT
        canonical.tokens.endsWith(query.tokens) -> MarkdownTitleMatch.TOKEN_SUFFIX
        canonical.tokens.containsAll(query.tokens) -> MarkdownTitleMatch.TOKENS
        else -> MarkdownTitleMatch.NONE
    }
}

private fun <T> List<T>.endsWith(suffix: List<T>): Boolean =
    suffix.isNotEmpty() && size >= suffix.size && takeLast(suffix.size) == suffix

private enum class MarkdownChannelSql(
    val channel: MarkdownSearchChannel,
    val configuration: String,
    val vector: String,
) {
    TECHNICAL(MarkdownSearchChannel.TECHNICAL, "simple", "technical_search_vector"),
    RUSSIAN(MarkdownSearchChannel.RUSSIAN, "russian", "russian_search_vector"),
    ENGLISH(MarkdownSearchChannel.ENGLISH, "english", "english_search_vector"),

    ;

    fun queryExpression(): String = if (this == TECHNICAL) {
        "plainto_tsquery('simple', ?) || plainto_tsquery('simple', ?)"
    } else {
        "plainto_tsquery('$configuration', ?)"
    }
}

private fun JsonElement.strings(): List<String> = jsonArray.map { it.jsonPrimitive.content }

private object ActivePublications : Table("active_documentation_publications") {
    val projectId = varchar("project_id", 80)
    val designSystemId = varchar("design_system_id", 128)
    val version = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val publicationId = varchar("publication_id", 80).references(Publications.id)
}

private object Publications : Table("documentation_publications") {
    val id = varchar("id", 80)
    val projectId = varchar("project_id", 80)
    val designSystemId = varchar("design_system_id", 128)
    val version = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val status = varchar("status", 32)
    override val primaryKey = PrimaryKey(id)
}

private object Pages : Table("documentation_pages") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80).references(Publications.id)
    val path = varchar("path", 1024)
    override val primaryKey = PrimaryKey(id)
}

private object Bindings : Table("code_bindings") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80).references(Publications.id)
    val subject = varchar("subject", 512)
    val kind = varchar("kind", 32)
    val name = text("name")
    override val primaryKey = PrimaryKey(id)
}

private object LookupTerms : Table("structured_lookup_terms") {
    val codeBindingId = varchar("code_binding_id", 128).references(Bindings.id)
    val publicationId = varchar("publication_id", 80)
    val original = text("original")
    val normalized = text("normalized")
    val category = varchar("category", 64)
}

private object KnowledgeChunks : Table("knowledge_chunks") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80).references(Publications.id)
    val pageId = varchar("page_id", 128).references(Pages.id)
    val contentId = varchar("content_id", 128)
    val sourcePath = varchar("source_path", 1024)
    val ordinal = integer("ordinal")
    val headingPath = jsonb<JsonElement>("heading_path", Json.Default)
    val pageTitle = text("page_title")
    val markdown = text("markdown")
    val searchText = text("search_text")
    val subjects = jsonb<JsonElement>("subjects", Json.Default)
    val kbUrl = varchar("kb_url", 1024)
    override val primaryKey = PrimaryKey(id)
}

private const val PUBLISHED = "published"
private val HTML_LIKE_TAG = Regex("<[^>]*>")
private val WHITESPACE = Regex("\\s+")
