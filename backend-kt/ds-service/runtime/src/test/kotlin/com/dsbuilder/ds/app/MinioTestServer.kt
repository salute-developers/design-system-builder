package com.dsbuilder.ds.app

import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.utility.DockerImageName
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.CreateBucketRequest
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request
import software.amazon.awssdk.services.s3.model.PutBucketPolicyRequest
import java.io.File
import java.net.URI
import java.util.concurrent.TimeUnit

/**
 * MinIO тестов в контейнере, общий на JVM. Образ тот же, что у локального контура (`dsbuilder-minio:local`
 * из `backend-kt/docker/minio`): официальные образы MinIO больше не публикуются, поэтому без образа он
 * собирается из Dockerfile. Без Docker, образа или сборки тест падает, а не пропускается.
 */
object MinioTestServer {
    /** Ключ записи. */
    const val ACCESS_KEY = "minio"

    /** Секрет записи. */
    const val SECRET_KEY = "minio123"

    /** Регион. */
    const val REGION = "us-east-1"

    private const val IMAGE = "dsbuilder-minio:local"
    private const val PORT = 9000
    private const val BUILD_TIMEOUT_MINUTES = 30L

    /** Адрес S3 API запущенного MinIO. */
    val endpoint: String by lazy(::start)

    /** Клиент S3 с ключами записи. */
    val client: S3Client by lazy {
        S3Client.builder()
            .region(Region.of(REGION))
            .endpointOverride(URI.create(endpoint))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(ACCESS_KEY, SECRET_KEY)))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .httpClientBuilder(UrlConnectionHttpClient.builder())
            .build()
    }

    /** Создаёт бакет с анонимным чтением, как `mc anonymous set download` в `minio-init`. */
    fun createPublicBucket(name: String) {
        client.createBucket(CreateBucketRequest.builder().bucket(name).build())
        val policy = """{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},""" +
            """"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::$name/*"]}]}"""
        client.putBucketPolicy(PutBucketPolicyRequest.builder().bucket(name).policy(policy).build())
    }

    /** Ключи объектов бакета под [prefix]. */
    fun keys(bucket: String, prefix: String): Set<String> =
        client.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build())
            .contents().map { it.key() }.toSet()

    private fun start(): String {
        ensureImage()
        val container = GenericContainer<Nothing>(DockerImageName.parse(IMAGE)).apply {
            withCommand("server", "/data")
            withEnv("MINIO_ROOT_USER", ACCESS_KEY)
            withEnv("MINIO_ROOT_PASSWORD", SECRET_KEY)
            withExposedPorts(PORT)
            waitingFor(Wait.forHttp("/minio/health/live").forPort(PORT))
        }
        container.start()
        Runtime.getRuntime().addShutdownHook(Thread({ container.stop() }, "ds-test-minio-cleanup"))
        return "http://${container.host}:${container.getMappedPort(PORT)}"
    }

    private fun ensureImage() {
        val docker = DockerClientFactory.instance().client()
        val present = runCatching { docker.inspectImageCmd(IMAGE).exec() }.isSuccess
        if (present) return
        val context = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, "docker/minio") }
            .firstOrNull { File(it, "Dockerfile").isFile }
            ?: error("backend-kt/docker/minio/Dockerfile not found: cannot build $IMAGE")
        val process = ProcessBuilder("docker", "build", "-t", IMAGE, context.path).inheritIO().start()
        check(process.waitFor(BUILD_TIMEOUT_MINUTES, TimeUnit.MINUTES) && process.exitValue() == 0) {
            "docker build of $IMAGE failed"
        }
    }
}
