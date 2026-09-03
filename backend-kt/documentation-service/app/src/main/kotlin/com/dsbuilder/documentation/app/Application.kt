package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.ingestion.application.AcceptDocumentationBundleUseCase
import com.dsbuilder.documentation.ingestion.data.ArchiveLimits
import com.dsbuilder.documentation.ingestion.data.BoundedBundleUpload
import com.dsbuilder.documentation.ingestion.data.DbServiceOwnershipVerifier
import com.dsbuilder.documentation.ingestion.data.ExposedDocumentationBundleRepository
import com.dsbuilder.documentation.ingestion.data.ExposedIngestionJobRepository
import com.dsbuilder.documentation.ingestion.data.JdbcTransactionManager
import com.dsbuilder.documentation.ingestion.data.S3RawBundleStorage
import com.dsbuilder.documentation.ingestion.data.TarGzipBundleArchiveInspector
import com.dsbuilder.documentation.ingestion.presentation.documentationBundleRoutes
import com.dsbuilder.documentation.processing.application.ProcessDocumentationJobUseCase
import com.dsbuilder.documentation.processing.application.ProcessingWorkerPolicy
import com.dsbuilder.documentation.processing.application.PublicationContextProvider
import com.dsbuilder.documentation.processing.application.RawBundleDescriptorProvider
import com.dsbuilder.documentation.processing.data.AstDocumentationChunker
import com.dsbuilder.documentation.processing.data.DeepDocumentationValidator
import com.dsbuilder.documentation.processing.data.DocumentationChunkLimits
import com.dsbuilder.documentation.processing.data.DocumentationValidationLimits
import com.dsbuilder.documentation.processing.data.ExposedCandidateIndexer
import com.dsbuilder.documentation.processing.data.ExposedProcessingContextRepository
import com.dsbuilder.documentation.processing.data.ExposedProcessingJobStore
import com.dsbuilder.documentation.processing.data.PublicationObjectKeyPolicy
import com.dsbuilder.documentation.processing.data.ResolvedDocumentationNormalizer
import com.dsbuilder.documentation.processing.data.S3ImmutableObjectWriter
import com.dsbuilder.documentation.processing.data.S3PublicationObjectStorage
import com.dsbuilder.documentation.processing.data.S3RawObjectStream
import com.dsbuilder.documentation.processing.data.SafeTarGzipBundleExtractor
import com.dsbuilder.documentation.publication.data.ExposedPublicationReadRepository
import com.dsbuilder.documentation.publication.data.S3AssetContentReader
import com.dsbuilder.documentation.publication.presentation.publicationReadRoutes
import com.dsbuilder.documentation.search.application.FetchKnowledgeChunkUseCase
import com.dsbuilder.documentation.search.application.LexicalRankingProfile
import com.dsbuilder.documentation.search.application.SearchDocumentationUseCase
import com.dsbuilder.documentation.search.data.ExposedDocumentationSearchRepository
import com.dsbuilder.documentation.search.presentation.DocumentationSearchLimits
import com.dsbuilder.documentation.search.presentation.documentationSearchRoutes
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopping
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.Json
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3ClientBuilder
import software.amazon.awssdk.services.s3.S3Configuration
import java.net.URI
import java.nio.file.Path
import java.time.Duration
import java.time.Instant
import java.util.UUID

/** Точка входа documentation service. */
fun main(args: Array<String>) = EngineMain.main(args)

/** Настраивает HTTP runtime и маршруты сервиса. */
fun Application.module() {
    install(Koin) {
        slf4jLogger()
        modules(module { })
    }
    install(CallLogging)
    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = false }) }
    val runtime = ingestionRuntime()
    val workerJob = launchDocumentationWorker(
        runtime.worker.enabled,
        runtime.worker.pollingMs,
        runtime.worker.workerId,
        runtime.worker.processor,
        runtime.worker.health,
    )
    monitor.subscribe(ApplicationStopping) { workerJob?.cancel() }
    routing {
        get("/health") {
            call.respondText("ok")
        }
        get("/health/ready") {
            val databaseReady = try {
                transaction(runtime.database) { exec("SELECT 1") }
                true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                false
            }
            val storageReady = runtime.storage.isReady()
            if (databaseReady && storageReady) {
                call.respondText(
                    "ok",
                )
            } else {
                call.respond(HttpStatusCode.ServiceUnavailable, "not ready")
            }
        }
        get("/health/worker") {
            val snapshot = runtime.worker.health.snapshot()
            if (snapshot.healthy) call.respond(snapshot) else call.respond(HttpStatusCode.ServiceUnavailable, snapshot)
        }
        documentationBundleRoutes(runtime.useCase, runtime.uploader)
        publicationReadRoutes(
            ExposedPublicationReadRepository(runtime.database),
            S3AssetContentReader(runtime.s3Client, runtime.publicationBucket),
        )
        val searchRepository = ExposedDocumentationSearchRepository(runtime.database)
        documentationSearchRoutes(
            SearchDocumentationUseCase(searchRepository, searchRepository, runtime.searchProfile),
            FetchKnowledgeChunkUseCase(searchRepository),
            runtime.searchLimits,
        )
    }
}

private data class IngestionRuntime(
    val useCase: AcceptDocumentationBundleUseCase,
    val uploader: BoundedBundleUpload,
    val database: Database,
    val storage: S3RawBundleStorage,
    val s3Client: S3Client,
    val publicationBucket: String,
    val searchLimits: DocumentationSearchLimits,
    val searchProfile: LexicalRankingProfile,
    val worker: WorkerRuntime,
)

private data class WorkerRuntime(
    val enabled: Boolean,
    val pollingMs: Long,
    val workerId: String,
    val processor: ProcessDocumentationJobUseCase,
    val health: DocumentationWorkerHealth,
)

private fun ingestionRuntime(): IngestionRuntime {
    val environment = EnvironmentConfiguration()
    val database = createDatabase(environment)
    val s3Client = createS3Client(environment)
    val bucket = environment.value(S3_BUCKET, DEFAULT_S3_BUCKET)
    val storage = createStorage(environment, s3Client, bucket)
    val useCase = createUseCase(environment, database, storage)
    val worker = createWorkerRuntime(environment, database, s3Client, bucket)
    return IngestionRuntime(
        useCase = useCase,
        uploader = BoundedBundleUpload(
            Path.of(environment.value(TEMP_DIRECTORY, System.getProperty("java.io.tmpdir"))),
            environment.long(MAX_COMPRESSED_BYTES, DEFAULT_MAX_COMPRESSED_BYTES),
        ),
        database = database,
        storage = storage,
        s3Client = s3Client,
        publicationBucket = bucket,
        searchLimits = DocumentationSearchLimits(
            defaultLimit = environment.int(PAGINATION_DEFAULT_LIMIT, DEFAULT_PAGINATION_LIMIT),
            maxLimit = environment.int(PAGINATION_MAX_LIMIT, DEFAULT_PAGINATION_MAX_LIMIT),
            maxQueryBytes = environment.int(SEARCH_MAX_QUERY_BYTES, DEFAULT_SEARCH_MAX_QUERY_BYTES),
            maxSubjects = environment.int(SEARCH_MAX_SUBJECTS, DEFAULT_SEARCH_MAX_SUBJECTS),
            maxCursor = environment.int(SEARCH_MAX_CURSOR, DEFAULT_SEARCH_MAX_CURSOR),
        ),
        searchProfile = LexicalRankingProfile(
            version = environment.value(SEARCH_PROFILE_VERSION, DEFAULT_SEARCH_PROFILE_VERSION),
            channelCandidateLimit = environment.int(SEARCH_CHANNEL_CANDIDATES, DEFAULT_SEARCH_CHANNEL_CANDIDATES),
            totalCandidateLimit = environment.int(SEARCH_TOTAL_CANDIDATES, DEFAULT_SEARCH_TOTAL_CANDIDATES),
            fuzzyMinimumLength = environment.int(SEARCH_FUZZY_MINIMUM_LENGTH, DEFAULT_SEARCH_FUZZY_MINIMUM_LENGTH),
            fuzzyThreshold = environment.double(SEARCH_FUZZY_THRESHOLD, DEFAULT_SEARCH_FUZZY_THRESHOLD),
            rrfConstant = environment.int(SEARCH_RRF_CONSTANT, DEFAULT_SEARCH_RRF_CONSTANT),
            prefixWeight = environment.double(SEARCH_PREFIX_WEIGHT, DEFAULT_SEARCH_PREFIX_WEIGHT),
            trigramWeight = environment.double(SEARCH_TRIGRAM_WEIGHT, DEFAULT_SEARCH_TRIGRAM_WEIGHT),
            technicalWeight = environment.double(SEARCH_TECHNICAL_WEIGHT, DEFAULT_SEARCH_TECHNICAL_WEIGHT),
            russianWeight = environment.double(SEARCH_RUSSIAN_WEIGHT, DEFAULT_SEARCH_LANGUAGE_WEIGHT),
            englishWeight = environment.double(SEARCH_ENGLISH_WEIGHT, DEFAULT_SEARCH_LANGUAGE_WEIGHT),
            snippetLength = environment.int(SEARCH_SNIPPET_LENGTH, DEFAULT_SEARCH_SNIPPET_LENGTH),
            snippetContext = environment.int(SEARCH_SNIPPET_CONTEXT, DEFAULT_SEARCH_SNIPPET_CONTEXT),
        ),
        worker = worker,
    )
}

private fun createWorkerRuntime(
    environment: EnvironmentConfiguration,
    database: Database,
    s3Client: S3Client,
    bucket: String,
): WorkerRuntime {
    val enabled = environment.boolean(WORKER_ENABLED, DEFAULT_WORKER_ENABLED)
    val contexts = ExposedProcessingContextRepository(database)
    val keys = PublicationObjectKeyPolicy(environment.value(PUBLICATION_S3_PREFIX, DEFAULT_PUBLICATION_PREFIX))
    val extractor = SafeTarGzipBundleExtractor(
        S3RawObjectStream(s3Client),
        RawBundleDescriptorProvider(contexts::descriptor),
        Path.of(environment.value(TEMP_DIRECTORY, System.getProperty("java.io.tmpdir"))),
        createArchiveLimits(environment),
    )
    val jobs = ExposedProcessingJobStore(database)
    val processor = ProcessDocumentationJobUseCase(
        jobs = jobs,
        rawBundles = extractor,
        cleaner = extractor,
        validator = DeepDocumentationValidator(
            DocumentationValidationLimits(
                maxNavigationNodes = environment.int(MAX_NAVIGATION_NODES, DEFAULT_MAX_NAVIGATION_NODES),
                maxNavigationDepth = environment.int(MAX_NAVIGATION_DEPTH, DEFAULT_MAX_NAVIGATION_DEPTH),
                maxPages = environment.int(MAX_PAGES, DEFAULT_MAX_PAGES),
                maxContentFiles = environment.int(MAX_CONTENT_FILES, DEFAULT_MAX_CONTENT_FILES),
                maxStringBytes = environment.int(MAX_STRING_BYTES, DEFAULT_MAX_STRING_BYTES),
                maxPathBytes = environment.int(MAX_PATH_BYTES, DEFAULT_MAX_PATH_BYTES),
                maxFileBytes = environment.long(MAX_ENTRY_BYTES, DEFAULT_MAX_ENTRY_BYTES),
            ),
        ),
        normalizer = ResolvedDocumentationNormalizer(PublicationContextProvider(contexts::context), keys),
        chunker = AstDocumentationChunker(
            DocumentationChunkLimits(
                targetBytes = environment.int(CHUNK_TARGET_BYTES, DEFAULT_CHUNK_TARGET_BYTES),
                maxBytes = environment.int(CHUNK_MAX_BYTES, DEFAULT_CHUNK_MAX_BYTES),
            ),
        ),
        indexer = ExposedCandidateIndexer(database),
        publicationObjects = S3PublicationObjectStorage(bucket, keys, S3ImmutableObjectWriter(s3Client)),
        publications = jobs,
        policy = ProcessingWorkerPolicy(
            Duration.ofSeconds(environment.long(WORKER_LEASE_SECONDS, DEFAULT_WORKER_LEASE_SECONDS)),
            environment.int(WORKER_MAX_ATTEMPTS, DEFAULT_WORKER_MAX_ATTEMPTS),
            Duration.ofSeconds(environment.long(WORKER_HEARTBEAT_SECONDS, DEFAULT_WORKER_HEARTBEAT_SECONDS)),
        ),
    )
    return WorkerRuntime(
        enabled,
        environment.long(WORKER_POLLING_MS, DEFAULT_WORKER_POLLING_MS).coerceAtLeast(1),
        environment.value(WORKER_ID, "documentation-${UUID.randomUUID()}"),
        processor,
        DocumentationWorkerHealth(enabled),
    )
}

private fun createDatabase(environment: EnvironmentConfiguration): Database {
    val databaseUrl = environment.value(DATABASE_URL, DEFAULT_DATABASE_URL)
    val databaseUser = environment.value(DATABASE_USER, DEFAULT_DATABASE_USER)
    val databasePassword = environment.value(DATABASE_PASSWORD, DEFAULT_DATABASE_PASSWORD)
    Flyway.configure()
        .dataSource(databaseUrl, databaseUser, databasePassword)
        .sqlMigrationPrefix(FLYWAY_VERSIONED_PREFIX)
        .sqlMigrationSeparator(FLYWAY_SEPARATOR)
        .sqlMigrationSuffixes(FLYWAY_SQL_SUFFIX)
        .validateMigrationNaming(true)
        .load()
        .migrate()
    return Database.connect(
        url = databaseUrl,
        driver = POSTGRES_DRIVER,
        user = databaseUser,
        password = databasePassword,
    )
}

private fun createUseCase(
    environment: EnvironmentConfiguration,
    database: Database,
    storage: S3RawBundleStorage,
): AcceptDocumentationBundleUseCase {
    val httpClient = createDbServiceClient(environment)
    return AcceptDocumentationBundleUseCase(
        inspector = TarGzipBundleArchiveInspector(createArchiveLimits(environment)),
        ownershipVerifier = DbServiceOwnershipVerifier(
            httpClient,
            environment.value(DB_SERVICE_BASE_URL, DEFAULT_DB_SERVICE_BASE_URL),
        ),
        storage = storage,
        bundleRepository = ExposedDocumentationBundleRepository(database),
        jobRepository = ExposedIngestionJobRepository(),
        transactions = JdbcTransactionManager(database),
        clock = { Instant.now() },
        ids = { UUID.randomUUID().toString() },
    )
}

private fun createDbServiceClient(environment: EnvironmentConfiguration) = HttpClient(CIO) {
    followRedirects = false
    install(HttpTimeout) {
        connectTimeoutMillis = environment.long(DB_SERVICE_CONNECT_TIMEOUT, DEFAULT_DB_CONNECT_TIMEOUT)
        requestTimeoutMillis = environment.long(DB_SERVICE_REQUEST_TIMEOUT, DEFAULT_DB_REQUEST_TIMEOUT)
    }
}

private fun createStorage(
    environment: EnvironmentConfiguration,
    client: S3Client,
    bucket: String,
): S3RawBundleStorage = S3RawBundleStorage(
    client = client,
    bucket = bucket,
    prefix = environment.value(S3_PREFIX, EMPTY_PREFIX),
)

private fun createS3Client(environment: EnvironmentConfiguration): S3Client {
    val requestTimeout = Duration.ofMillis(environment.long(S3_REQUEST_TIMEOUT, DEFAULT_S3_REQUEST_TIMEOUT))
    val clientBuilder = createS3ClientBuilder(environment, requestTimeout)
    environment.optional(S3_ENDPOINT)?.let { clientBuilder.endpointOverride(URI.create(it)) }
    return clientBuilder.build()
}

private fun createS3ClientBuilder(
    environment: EnvironmentConfiguration,
    requestTimeout: Duration,
): S3ClientBuilder {
    val connectTimeout = Duration.ofMillis(environment.long(S3_CONNECT_TIMEOUT, DEFAULT_S3_CONNECT_TIMEOUT))
    val credentials = AwsBasicCredentials.create(
        environment.value(S3_ACCESS_KEY, DEFAULT_S3_ACCESS_KEY),
        environment.value(S3_SECRET_KEY, DEFAULT_S3_SECRET_KEY),
    )
    val httpClient = UrlConnectionHttpClient.builder()
        .connectionTimeout(connectTimeout)
        .socketTimeout(requestTimeout)
    val clientConfiguration = ClientOverrideConfiguration.builder()
        .apiCallTimeout(requestTimeout)
        .apiCallAttemptTimeout(requestTimeout)
        .build()
    return S3Client.builder()
        .region(Region.of(environment.value(S3_REGION, DEFAULT_S3_REGION)))
        .credentialsProvider(StaticCredentialsProvider.create(credentials))
        .serviceConfiguration(
            S3Configuration.builder()
                .pathStyleAccessEnabled(environment.boolean(S3_PATH_STYLE, DEFAULT_S3_PATH_STYLE))
                .build(),
        )
        .httpClientBuilder(httpClient)
        .overrideConfiguration(clientConfiguration)
}

private fun createArchiveLimits(environment: EnvironmentConfiguration) = ArchiveLimits(
    maxUncompressedBytes = environment.long(MAX_UNCOMPRESSED_BYTES, DEFAULT_MAX_UNCOMPRESSED_BYTES),
    maxEntryBytes = environment.long(MAX_ENTRY_BYTES, DEFAULT_MAX_ENTRY_BYTES),
    maxEntries = environment.int(MAX_ENTRIES, DEFAULT_MAX_ENTRIES),
    maxPathBytes = environment.int(MAX_PATH_BYTES, DEFAULT_MAX_PATH_BYTES),
    maxManifestBytes = environment.int(MAX_MANIFEST_BYTES, DEFAULT_MAX_MANIFEST_BYTES),
)

private class EnvironmentConfiguration {
    fun value(name: String, default: String): String = optional(name) ?: default
    fun optional(name: String): String? = System.getenv(name)?.takeIf(String::isNotBlank)
    fun long(name: String, default: Long): Long = optional(name)?.toLong() ?: default
    fun int(name: String, default: Int): Int = optional(name)?.toInt() ?: default
    fun double(name: String, default: Double): Double = optional(name)?.toDouble() ?: default
    fun boolean(name: String, default: Boolean): Boolean = optional(name)?.toBooleanStrictOrNull() ?: default
}

private const val DATABASE_URL = "DOCUMENTATION_DATABASE_URL"
private const val DATABASE_USER = "DOCUMENTATION_POSTGRES_USER"
private const val DATABASE_PASSWORD = "DOCUMENTATION_POSTGRES_PASSWORD"
private const val TEMP_DIRECTORY = "DOCUMENTATION_TEMP_DIRECTORY"
private const val MAX_COMPRESSED_BYTES = "DOCUMENTATION_MAX_COMPRESSED_BYTES"
private const val MAX_UNCOMPRESSED_BYTES = "DOCUMENTATION_MAX_UNCOMPRESSED_BYTES"
private const val MAX_ENTRY_BYTES = "DOCUMENTATION_MAX_ENTRY_BYTES"
private const val MAX_ENTRIES = "DOCUMENTATION_MAX_ENTRIES"
private const val MAX_PATH_BYTES = "DOCUMENTATION_MAX_PATH_BYTES"
private const val MAX_MANIFEST_BYTES = "DOCUMENTATION_MAX_MANIFEST_BYTES"
private const val DB_SERVICE_BASE_URL = "DB_SERVICE_BASE_URL"
private const val DB_SERVICE_CONNECT_TIMEOUT = "DB_SERVICE_CONNECT_TIMEOUT_MS"
private const val DB_SERVICE_REQUEST_TIMEOUT = "DB_SERVICE_REQUEST_TIMEOUT_MS"
private const val S3_ENDPOINT = "DOCUMENTATION_S3_ENDPOINT"
private const val S3_REGION = "DOCUMENTATION_S3_REGION"
private const val S3_BUCKET = "DOCUMENTATION_S3_BUCKET"
private const val S3_ACCESS_KEY = "DOCUMENTATION_S3_ACCESS_KEY"
private const val S3_SECRET_KEY = "DOCUMENTATION_S3_SECRET_KEY"
private const val S3_PATH_STYLE = "DOCUMENTATION_S3_PATH_STYLE_ACCESS"
private const val S3_PREFIX = "DOCUMENTATION_S3_PREFIX"
private const val S3_CONNECT_TIMEOUT = "DOCUMENTATION_S3_CONNECT_TIMEOUT_MS"
private const val S3_REQUEST_TIMEOUT = "DOCUMENTATION_S3_REQUEST_TIMEOUT_MS"
private const val PAGINATION_DEFAULT_LIMIT = "DOCUMENTATION_PAGINATION_DEFAULT_LIMIT"
private const val PAGINATION_MAX_LIMIT = "DOCUMENTATION_PAGINATION_MAX_LIMIT"
private const val SEARCH_MAX_QUERY_BYTES = "DOCUMENTATION_SEARCH_MAX_QUERY_BYTES"
private const val SEARCH_MAX_SUBJECTS = "DOCUMENTATION_SEARCH_MAX_SUBJECTS"
private const val SEARCH_MAX_CURSOR = "DOCUMENTATION_SEARCH_MAX_CURSOR"
private const val SEARCH_PROFILE_VERSION = "DOCUMENTATION_SEARCH_PROFILE_VERSION"
private const val SEARCH_CHANNEL_CANDIDATES = "DOCUMENTATION_SEARCH_CHANNEL_CANDIDATES"
private const val SEARCH_TOTAL_CANDIDATES = "DOCUMENTATION_SEARCH_TOTAL_CANDIDATES"
private const val SEARCH_FUZZY_MINIMUM_LENGTH = "DOCUMENTATION_SEARCH_FUZZY_MINIMUM_LENGTH"
private const val SEARCH_FUZZY_THRESHOLD = "DOCUMENTATION_SEARCH_FUZZY_THRESHOLD"
private const val SEARCH_RRF_CONSTANT = "DOCUMENTATION_SEARCH_RRF_CONSTANT"
private const val SEARCH_PREFIX_WEIGHT = "DOCUMENTATION_SEARCH_PREFIX_WEIGHT"
private const val SEARCH_TRIGRAM_WEIGHT = "DOCUMENTATION_SEARCH_TRIGRAM_WEIGHT"
private const val SEARCH_TECHNICAL_WEIGHT = "DOCUMENTATION_SEARCH_TECHNICAL_WEIGHT"
private const val SEARCH_RUSSIAN_WEIGHT = "DOCUMENTATION_SEARCH_RUSSIAN_WEIGHT"
private const val SEARCH_ENGLISH_WEIGHT = "DOCUMENTATION_SEARCH_ENGLISH_WEIGHT"
private const val SEARCH_SNIPPET_LENGTH = "DOCUMENTATION_SEARCH_SNIPPET_LENGTH"
private const val SEARCH_SNIPPET_CONTEXT = "DOCUMENTATION_SEARCH_SNIPPET_CONTEXT"
private const val WORKER_ENABLED = "DOCUMENTATION_WORKER_ENABLED"
private const val WORKER_POLLING_MS = "DOCUMENTATION_WORKER_POLLING_MS"
private const val WORKER_LEASE_SECONDS = "DOCUMENTATION_WORKER_LEASE_SECONDS"
private const val WORKER_HEARTBEAT_SECONDS = "DOCUMENTATION_WORKER_HEARTBEAT_SECONDS"
private const val WORKER_MAX_ATTEMPTS = "DOCUMENTATION_WORKER_MAX_ATTEMPTS"
private const val WORKER_ID = "DOCUMENTATION_WORKER_ID"
private const val PUBLICATION_S3_PREFIX = "DOCUMENTATION_PUBLICATION_S3_PREFIX"
private const val MAX_NAVIGATION_NODES = "DOCUMENTATION_MAX_NAVIGATION_NODES"
private const val MAX_NAVIGATION_DEPTH = "DOCUMENTATION_MAX_NAVIGATION_DEPTH"
private const val MAX_PAGES = "DOCUMENTATION_MAX_PAGES"
private const val MAX_CONTENT_FILES = "DOCUMENTATION_MAX_CONTENT_FILES"
private const val MAX_STRING_BYTES = "DOCUMENTATION_MAX_STRING_BYTES"
private const val CHUNK_MAX_BYTES = "DOCUMENTATION_CHUNK_MAX_BYTES"
private const val CHUNK_TARGET_BYTES = "DOCUMENTATION_CHUNK_TARGET_BYTES"

private const val DEFAULT_DATABASE_URL = "jdbc:postgresql://localhost:5434/documentation_service"
private const val DEFAULT_DATABASE_USER = "documentation"
private const val DEFAULT_DATABASE_PASSWORD = "documentation"
private const val DEFAULT_DB_SERVICE_BASE_URL = "http://localhost:3008"
private const val DEFAULT_S3_REGION = "us-east-1"
private const val DEFAULT_S3_BUCKET = "documentation-bundles"
private const val DEFAULT_S3_ACCESS_KEY = "minio"
private const val DEFAULT_S3_SECRET_KEY = "minio123"
private const val EMPTY_PREFIX = ""
private const val POSTGRES_DRIVER = "org.postgresql.Driver"
private const val FLYWAY_VERSIONED_PREFIX = "V"
private const val FLYWAY_SEPARATOR = "__"
private const val FLYWAY_SQL_SUFFIX = ".sql"
private const val DEFAULT_MAX_COMPRESSED_BYTES = 100L * 1024 * 1024
private const val DEFAULT_MAX_UNCOMPRESSED_BYTES = 500L * 1024 * 1024
private const val DEFAULT_MAX_ENTRY_BYTES = 100L * 1024 * 1024
private const val DEFAULT_MAX_ENTRIES = 20_000
private const val DEFAULT_MAX_PATH_BYTES = 255
private const val DEFAULT_MAX_MANIFEST_BYTES = 1024 * 1024
private const val DEFAULT_DB_CONNECT_TIMEOUT = 1_500L
private const val DEFAULT_DB_REQUEST_TIMEOUT = 3_000L
private const val DEFAULT_S3_CONNECT_TIMEOUT = 2_000L
private const val DEFAULT_S3_REQUEST_TIMEOUT = 10_000L
private const val DEFAULT_S3_PATH_STYLE = true
private const val DEFAULT_PAGINATION_LIMIT = 20
private const val DEFAULT_PAGINATION_MAX_LIMIT = 100
private const val DEFAULT_SEARCH_MAX_QUERY_BYTES = 1024
private const val DEFAULT_SEARCH_MAX_SUBJECTS = 50
private const val DEFAULT_SEARCH_MAX_CURSOR = 1_000
private const val DEFAULT_SEARCH_PROFILE_VERSION = "lexical-v2"
private const val DEFAULT_SEARCH_CHANNEL_CANDIDATES = 200
private const val DEFAULT_SEARCH_TOTAL_CANDIDATES = 500
private const val DEFAULT_SEARCH_FUZZY_MINIMUM_LENGTH = 5
private const val DEFAULT_SEARCH_FUZZY_THRESHOLD = 0.45
private const val DEFAULT_SEARCH_RRF_CONSTANT = 60
private const val DEFAULT_SEARCH_PREFIX_WEIGHT = 0.75
private const val DEFAULT_SEARCH_TRIGRAM_WEIGHT = 0.60
private const val DEFAULT_SEARCH_TECHNICAL_WEIGHT = 1.0
private const val DEFAULT_SEARCH_LANGUAGE_WEIGHT = 0.95
private const val DEFAULT_SEARCH_SNIPPET_LENGTH = 300
private const val DEFAULT_SEARCH_SNIPPET_CONTEXT = 120
private const val DEFAULT_WORKER_ENABLED = false
private const val DEFAULT_WORKER_POLLING_MS = 1_000L
private const val DEFAULT_WORKER_LEASE_SECONDS = 60L
private const val DEFAULT_WORKER_HEARTBEAT_SECONDS = 20L
private const val DEFAULT_WORKER_MAX_ATTEMPTS = 3
private const val DEFAULT_PUBLICATION_PREFIX = EMPTY_PREFIX
private const val DEFAULT_MAX_NAVIGATION_NODES = 10_000
private const val DEFAULT_MAX_NAVIGATION_DEPTH = 32
private const val DEFAULT_MAX_PAGES = 5_000
private const val DEFAULT_MAX_CONTENT_FILES = 10_000
private const val DEFAULT_MAX_STRING_BYTES = 65_536
private const val DEFAULT_CHUNK_MAX_BYTES = 24_000
private const val DEFAULT_CHUNK_TARGET_BYTES = 12_000
