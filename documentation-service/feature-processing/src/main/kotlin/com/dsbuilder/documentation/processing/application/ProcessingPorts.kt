package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.CodeBinding
import com.dsbuilder.documentation.publication.domain.DocumentationAsset
import com.dsbuilder.documentation.publication.domain.DocumentationContent
import com.dsbuilder.documentation.publication.domain.DocumentationNavigationNode
import com.dsbuilder.documentation.publication.domain.DocumentationPage
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.KnowledgeChunk
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import com.dsbuilder.documentation.publication.domain.StructuredLookupTerm
import java.nio.file.Path
import java.time.Duration

/** Настройки worker lease/retry. */
data class ProcessingWorkerPolicy(
    /** Срок lease. */
    val leaseDuration: Duration,
    /** Максимум attempts. */
    val maxAttempts: Int,
    /** Интервал фонового heartbeat во время обработки. */
    val heartbeatInterval: Duration = leaseDuration.dividedBy(3),
) {
    init {
        require(!leaseDuration.isZero && !leaseDuration.isNegative)
        require(!heartbeatInterval.isZero && !heartbeatInterval.isNegative)
        require(heartbeatInterval < leaseDuration)
        require(maxAttempts > 0)
    }
}

/** Claim с подтверждённым владельцем lease. */
data class ClaimedIngestionJob(
    /** Job snapshot. */
    val job: IngestionJob,
    /** Worker-владелец. */
    val workerId: String,
)

/** Port очереди и условных state transitions. */
interface ProcessingJobStore {
    /** Атомарно claim-ит следующую eligible job. */
    suspend fun claim(workerId: String, leaseDuration: Duration, maxAttempts: Int): ClaimedIngestionJob?

    /** Продлевает lease только для текущего владельца. */
    suspend fun heartbeat(claim: ClaimedIngestionJob, leaseDuration: Duration): Boolean

    /** Проверяет актуальность lease. */
    suspend fun ownsLease(claim: ClaimedIngestionJob): Boolean

    /** Условно переводит job на следующую стадию. */
    suspend fun transition(claim: ClaimedIngestionJob, status: IngestionStatus): Boolean

    /** Сохраняет diagnostics текущего attempt. */
    suspend fun replaceDiagnostics(claim: ClaimedIngestionJob, diagnostics: List<ProcessingDiagnostic>): Boolean

    /** Завершает job контентной либо исчерпанной transient ошибкой. */
    suspend fun fail(claim: ClaimedIngestionJob, failure: ProcessingFailure): Boolean

    /** Возвращает job в eligible состояние после transient failure. */
    suspend fun releaseForRetry(claim: ClaimedIngestionJob, failure: ProcessingFailure): Boolean
}

/** Локальное содержимое безопасно извлечённого bundle. */
data class ExtractedBundle(
    /** Корень attempt-scoped temporary tree. */
    val root: Path,
    /** Идентификатор исходного bundle. */
    val bundleId: String,
)

/** Metadata immutable raw bundle object. */
data class RawBundleDescriptor(
    /** Идентификатор bundle. */
    val bundleId: String,
    /** S3 bucket. */
    val bucket: String,
    /** S3 object key. */
    val key: String,
    /** Persisted SHA-256 compressed object. */
    val sha256: String,
)

/** Port чтения metadata raw bundle. */
fun interface RawBundleDescriptorProvider {
    /** Возвращает committed metadata для job. */
    suspend fun get(job: IngestionJob): RawBundleDescriptor
}

/** Port raw archive storage. */
fun interface RawBundleReader {
    /** Потоково извлекает и проверяет persisted checksum. */
    suspend fun downloadAndExtract(job: IngestionJob): ExtractedBundle
}

/** Port lifecycle temporary tree. */
fun interface TemporaryExtractionCleaner {
    /** Удаляет attempt-scoped tree. */
    suspend fun cleanup(bundle: ExtractedBundle)
}

/** Результат deep validation. */
data class ValidatedBundle(
    /** Извлечённый bundle. */
    val extracted: ExtractedBundle,
    /** Разобранный `dsb-resolved-docs-v1`. */
    val documentation: ResolvedDocumentation = ResolvedDocumentation(emptyList()),
    /** Неблокирующие warnings. */
    val diagnostics: List<ProcessingDiagnostic>,
) {
    /** Есть ли blocking diagnostics. */
    val hasErrors: Boolean get() = diagnostics.any { it.level.name == "ERROR" }
}

/** Разобранная resolved documentation. */
data class ResolvedDocumentation(
    /** Ordered navigation roots. */
    val navigation: List<ResolvedDocumentationNode>,
)

/** Узел resolved navigation. */
data class ResolvedDocumentationNode(
    /** Отображаемый заголовок. */
    val title: String,
    /** Canonical subjects страницы или группы. */
    val subjects: List<String>,
    /** Скрыт ли узел из navigation. */
    val hidden: Boolean,
    /** Ordered дочерние узлы группы. */
    val items: List<ResolvedDocumentationNode>,
    /** Bundle-relative path страницы. */
    val path: String?,
    /** Формат содержимого страницы. */
    val contentFormat: String,
    /** Ordered content references. */
    val contentRefs: List<ResolvedContentReference>,
)

/** Source resolved content. */
enum class ResolvedContentSource {
    /** Базовая документация дизайн-системы. */
    CORE,

    /** Пользовательское дополнение документации. */
    USER,
}

/** Ссылка на resolved content file. */
data class ResolvedContentReference(
    /** Семантический источник содержимого. */
    val source: ResolvedContentSource,
    /** Bundle-relative path content file. */
    val path: String,
)

/** Port deep validation. */
fun interface DocumentationValidator {
    /** Проверяет schema, navigation, content, subjects, links и artifacts. */
    suspend fun validate(job: IngestionJob, bundle: ExtractedBundle): ValidatedBundle
}

/** Полностью нормализованный candidate. */
data class NormalizedCandidate(
    /** Attempt-scoped корень извлечённого bundle. */
    val sourceRoot: Path,
    /** Candidate publication. */
    val publication: DocumentationPublication,
    /** Ordered navigation. */
    val navigation: List<DocumentationNavigationNode>,
    /** Нормализованные страницы. */
    val pages: List<DocumentationPage>,
    /** Ordered content blocks. */
    val content: List<DocumentationContent>,
    /** Опубликованные assets. */
    val assets: List<DocumentationAsset>,
    /** Metadata structured artifacts. */
    val structuredArtifacts: List<StructuredArtifact>,
    /** Canonical code bindings. */
    val bindings: List<CodeBinding>,
    /** Structured lookup terms. */
    val lookupTerms: List<StructuredLookupTerm>,
    /** Связи content с referenced assets. */
    val contentAssets: List<ContentAssetLink> = emptyList(),
)

/** Нормализованная связь markdown content и asset. */
data class ContentAssetLink(
    /** Content ID. */ val contentId: String,
    /** Asset ID. */ val assetId: String,
)

/** Port normalization и adapter registry. */
fun interface DocumentationNormalizer {
    /** Строит deterministic candidate data. */
    suspend fun normalize(job: IngestionJob, bundle: ValidatedBundle): NormalizedCandidate
}

/** Контекст publication, сохранённый при приёме bundle. */
data class PublicationContext(
    /** Project-владелец. */
    val projectId: String,
    /** Ключ active publication. */
    val key: ActivePublicationKey,
    /** Опциональные structured artifacts из проверенного manifest. */
    val structuredArtifacts: List<StructuredSourceDeclaration> = emptyList(),
)

/** Trusted declaration structured artifact из manifest. */
data class StructuredSourceDeclaration(
    /** Тип structured artifact. */
    val type: com.dsbuilder.documentation.publication.domain.StructuredArtifactType,
    /** Bundle-relative source path. */
    val path: String,
    /** Versioned format либо `null` для диагностируемого invalid manifest. */
    val format: String?,
)

/** Port чтения publication context исходного bundle. */
fun interface PublicationContextProvider {
    /** Возвращает trusted metadata принятого bundle. */
    suspend fun get(job: IngestionJob): PublicationContext
}

/** Candidate с knowledge chunks. */
data class ChunkedCandidate(
    /** Нормализованный candidate. */
    val normalized: NormalizedCandidate,
    /** Ordered knowledge chunks. */
    val chunks: List<KnowledgeChunk>,
    /** Неблокирующие diagnostics chunking. */
    val diagnostics: List<ProcessingDiagnostic> = emptyList(),
)

/** Port AST chunking. */
fun interface DocumentationChunker {
    /** Строит ordered chunks без разрыва atomic AST blocks. */
    suspend fun chunk(candidate: NormalizedCandidate): ChunkedCandidate
}

/** Port deterministic candidate persistence и search indexing. */
fun interface CandidateIndexer {
    /** Lease-fenced idempotent upsert normalized candidate и FTS projections. */
    suspend fun index(claim: ClaimedIngestionJob, candidate: ChunkedCandidate): Boolean
}

/** Port immutable publication storage. */
fun interface PublicationObjectStorage {
    /** Копирует content/assets/source artifacts под immutable publication prefix. */
    suspend fun store(candidate: NormalizedCandidate)
}

/** Port atomic active publication switch. */
fun interface AtomicPublicationStore {
    /** Публикует candidate только при действующей lease. */
    suspend fun publish(claim: ClaimedIngestionJob, publicationId: String): Boolean
}

/** Классифицированная processing failure. */
class ProcessingFailure(
    /** Стабильный код. */
    val code: String,
    /** Безопасное сообщение. */
    override val message: String,
    /** Разрешён ли retry. */
    val retryable: Boolean,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
