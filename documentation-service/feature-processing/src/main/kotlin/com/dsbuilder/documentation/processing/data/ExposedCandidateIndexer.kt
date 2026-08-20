package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.CandidateIndexer
import com.dsbuilder.documentation.processing.application.ChunkedCandidate
import com.dsbuilder.documentation.processing.application.ClaimedIngestionJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/** Idempotent Exposed persistence normalized candidate и search projections. */
class ExposedCandidateIndexer(private val database: Database) : CandidateIndexer {
    override suspend fun index(claim: ClaimedIngestionJob, candidate: ChunkedCandidate): Boolean =
        withContext(Dispatchers.IO) {
            transaction(database) { persist(claim, candidate) }
        }

    @Suppress("LongMethod")
    private fun JdbcTransaction.persist(claim: ClaimedIngestionJob, candidate: ChunkedCandidate): Boolean {
        val normalized = candidate.normalized
        val publication = normalized.publication
        if (!lockOwnedJob(claim) || claim.job.publicationId != publication.id) return false
        val persistedStatus = PublicationsTable.select(PublicationsTable.status)
            .where { PublicationsTable.id eq publication.id }
            .singleOrNull()?.get(PublicationsTable.status)
        if (persistedStatus != null && persistedStatus != CANDIDATE) return false
        if (persistedStatus == null) {
            PublicationsTable.insert {
                it[id] = publication.id
                it[projectId] = publication.projectId
                it[bundleId] = publication.bundleId
                it[designSystemId] = publication.key.designSystemId
                it[version] = publication.key.version
                it[platform] = publication.key.platform
                it[status] = CANDIDATE
                it[createdAt] = publication.createdAt
            }
        }
        deleteCandidateChildren(publication.id)
        NavigationTable.batchInsert(normalized.navigation) { node ->
            this[NavigationTable.id] = node.id
            this[NavigationTable.publicationId] = node.publicationId
            this[NavigationTable.parentId] = node.parentId
            this[NavigationTable.kind] = node.kind.name.lowercase()
            this[NavigationTable.title] = node.title
            this[NavigationTable.pagePath] = node.pagePath
            this[NavigationTable.ordinal] = node.ordinal
        }
        PagesTable.batchInsert(normalized.pages) { page ->
            this[PagesTable.id] = page.id
            this[PagesTable.publicationId] = page.publicationId
            this[PagesTable.path] = page.path
            this[PagesTable.title] = page.title
            this[PagesTable.subjects] = page.subjects.jsonArray()
        }
        ContentTable.batchInsert(normalized.content) { content ->
            this[ContentTable.id] = content.id
            this[ContentTable.publicationId] = publication.id
            this[ContentTable.pageId] = content.pageId
            this[ContentTable.sourcePath] = content.sourcePath
            this[ContentTable.contentSource] = content.source.name.lowercase()
            this[ContentTable.ordinal] = content.ordinal
            this[ContentTable.storageKey] = content.storageKey
            this[ContentTable.sha256] = content.sha256
            this[ContentTable.size] = content.size
        }
        AssetsTable.batchInsert(normalized.assets) { asset ->
            this[AssetsTable.id] = asset.id
            this[AssetsTable.publicationId] = asset.publicationId
            this[AssetsTable.path] = asset.path
            this[AssetsTable.storageKey] = asset.storageKey
            this[AssetsTable.mediaType] = asset.mediaType
            this[AssetsTable.sha256] = asset.sha256
            this[AssetsTable.size] = asset.size
        }
        ContentAssetsTable.batchInsert(normalized.contentAssets) { link ->
            this[ContentAssetsTable.contentId] = link.contentId
            this[ContentAssetsTable.assetId] = link.assetId
        }
        StructuredArtifactsTable.batchInsert(normalized.structuredArtifacts) { artifact ->
            this[StructuredArtifactsTable.id] = artifact.id
            this[StructuredArtifactsTable.publicationId] = artifact.publicationId
            this[StructuredArtifactsTable.type] = artifact.type.name.lowercase()
            this[StructuredArtifactsTable.format] = artifact.format
            this[StructuredArtifactsTable.storageKey] = artifact.storageKey
            this[StructuredArtifactsTable.sha256] = artifact.sha256
            this[StructuredArtifactsTable.size] = artifact.size
        }
        val termsByBinding = normalized.lookupTerms.groupBy { it.codeBindingId }
        CodeBindingsTable.batchInsert(normalized.bindings) { binding ->
            this[CodeBindingsTable.id] = binding.id
            this[CodeBindingsTable.structuredArtifactId] = binding.structuredArtifactId
            this[CodeBindingsTable.publicationId] = binding.publicationId
            this[CodeBindingsTable.subject] = binding.subject
            this[CodeBindingsTable.kind] = binding.kind.name.lowercase().replace('_', '-')
            this[CodeBindingsTable.name] = binding.name
            this[CodeBindingsTable.platform] = binding.platform
            this[CodeBindingsTable.platformPayload] = Json.parseToJsonElement(binding.platformPayload)
            this[CodeBindingsTable.technicalProjection] = termsByBinding[binding.id]
                .orEmpty().joinToString(" ") { it.original }
        }
        LookupTermsTable.batchInsert(normalized.lookupTerms) { term ->
            this[LookupTermsTable.id] = term.id
            this[LookupTermsTable.codeBindingId] = term.codeBindingId
            this[LookupTermsTable.publicationId] = publication.id
            this[LookupTermsTable.original] = term.original
            this[LookupTermsTable.normalized] = term.normalized
            this[LookupTermsTable.tokenized] = term.tokenized
            this[LookupTermsTable.category] = term.category
        }
        KnowledgeChunksTable.batchInsert(candidate.chunks) { chunk ->
            this[KnowledgeChunksTable.id] = chunk.id
            this[KnowledgeChunksTable.publicationId] = chunk.publicationId
            this[KnowledgeChunksTable.pageId] = chunk.pageId
            this[KnowledgeChunksTable.contentId] = chunk.contentId
            this[KnowledgeChunksTable.sourcePath] = chunk.sourcePath
            this[KnowledgeChunksTable.ordinal] = chunk.ordinal
            this[KnowledgeChunksTable.headingPath] = chunk.headingPath.jsonArray()
            this[KnowledgeChunksTable.pageTitle] = chunk.pageTitle
            this[KnowledgeChunksTable.markdown] = chunk.markdown
            this[KnowledgeChunksTable.searchText] = chunk.searchText
            this[KnowledgeChunksTable.codeText] = chunk.codeText
            this[KnowledgeChunksTable.subjects] = chunk.subjects.jsonArray()
            this[KnowledgeChunksTable.approximateSize] = chunk.approximateSize
            this[KnowledgeChunksTable.kbUrl] = chunk.kbUrl
        }
        return true
    }

    private fun JdbcTransaction.lockOwnedJob(claim: ClaimedIngestionJob): Boolean = exec(
        """
            SELECT 1 FROM ingestion_jobs
            WHERE id = ? AND worker_id = ? AND attempt = ? AND lease_until > now()
            FOR UPDATE
        """.trimIndent(),
        args = listOf(
            VarCharColumnType(80) to claim.job.id,
            VarCharColumnType(128) to claim.workerId,
            IntegerColumnType() to claim.job.attempt,
        ),
        explicitStatementType = StatementType.SELECT,
    ) { it.next() } ?: false

    private fun deleteCandidateChildren(publicationId: String) {
        KnowledgeChunksTable.deleteWhere { KnowledgeChunksTable.publicationId eq publicationId }
        LookupTermsTable.deleteWhere { LookupTermsTable.publicationId eq publicationId }
        CodeBindingsTable.deleteWhere { CodeBindingsTable.publicationId eq publicationId }
        StructuredArtifactsTable.deleteWhere { StructuredArtifactsTable.publicationId eq publicationId }
        ContentTable.deleteWhere { ContentTable.publicationId eq publicationId }
        AssetsTable.deleteWhere { AssetsTable.publicationId eq publicationId }
        PagesTable.deleteWhere { PagesTable.publicationId eq publicationId }
        NavigationTable.deleteWhere { NavigationTable.publicationId eq publicationId }
    }

    private fun List<String>.jsonArray() = JsonArray(map(::JsonPrimitive))

    private companion object {
        const val CANDIDATE = "candidate"
    }
}
