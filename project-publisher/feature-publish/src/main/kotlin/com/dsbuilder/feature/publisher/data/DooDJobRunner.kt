package com.dsbuilder.feature.publisher.data

import com.dsbuilder.feature.publisher.application.port.JobRunner
import com.dsbuilder.feature.publisher.application.port.JobRunner.JobResult
import com.dsbuilder.feature.publisher.application.port.JobRunner.RunnerConfig
import com.dsbuilder.feature.publisher.domain.entity.ArtifactType
import com.dsbuilder.feature.publisher.domain.entity.JobArtifactLink
import com.dsbuilder.feature.publisher.domain.entity.JobParams
import com.dsbuilder.feature.publisher.domain.entity.JobTarget
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.io.IOException
import java.io.File
import java.util.*
import java.util.concurrent.TimeUnit

internal class DooDJobRunner(
    val id: UUID,
    val params: JobParams,
    val config: RunnerConfig = RunnerConfig(),
    private val coroutineDispatcher: CoroutineDispatcher = Dispatchers.IO,
): JobRunner {

    private var _process: Process? = null
    private val processBuilder by lazy {
        val args = mutableListOf(
            "bash", "scripts/run_build_in_docker.sh",
            "--build-id", id.toString(),
            "--job-params", params.toRunParams(),
            "--baseImage", params.target.baseImage(),
            "--image", params.target.imageName(),
            "--platform", config.platform,
        )
        val dockerfile = params.target.dockerfile()
        if (dockerfile != null) {
            args.add("--dockerfile")
            args.add(dockerfile)
        }
        ProcessBuilder(args).apply {
            redirectErrorStream(false)
            directory(File("/app"))
        }
    }

    val isAlive: Boolean
        get() = _process?.isAlive == true

    private val _logs = MutableSharedFlow<String>(
        replay = 1000,
        extraBufferCapacity = 100
    )

    val logs: Flow<String>
        get() = _logs.asSharedFlow()


    private suspend fun readStdout(process: Process) = withContext(coroutineDispatcher) {
        process.inputStream.bufferedReader().useLines { lines ->
            lines.forEach { line ->
                _logs.emit(line)
            }
        }
    }

    private suspend fun readStderr(process: Process, errorBuffer: StringBuilder) = withContext(coroutineDispatcher) {
        process.errorStream.bufferedReader().useLines { lines ->
            lines.forEach { line ->
                errorBuffer.appendLine(line)
                _logs.emit(line)
            }
        }
    }

    override suspend fun run(): JobResult = withContext(coroutineDispatcher) {
        val process = try {
            processBuilder.start()
        } catch (e: IOException) {
            e.printStackTrace()
            return@withContext JobResult.Fail(500, e.message)
        }
        _process = process

        coroutineScope {
            val errorBuffer = StringBuilder()

            val outJob = launch { readStdout(process) }
            val errJob = launch { readStderr(process, errorBuffer) }

            val exitCode = try {
                process.waitFor()
            } catch (e: Exception) {
                e.printStackTrace()
                500
            }
            _process = null

            // Ensure stream readers finish
            outJob.join()
            errJob.join()

            if (exitCode == 0) {
                JobResult.Success(prepareArtifacts())
            } else {
                val errorOutput = errorBuffer.toString().ifBlank { "Process failed with exit code $exitCode" }
                // Surface the final error summary into the error log stream as well
                _logs.emit("❌ $errorOutput")
                JobResult.Fail(exitCode, message = errorOutput)
            }
        }
    }

    override suspend fun cancel(): Boolean = withContext(coroutineDispatcher) {
        val process = _process ?: return@withContext false
        return@withContext try {
            // 1. Попробуем завершить docker-контейнер по имени build-id
            val containerName = id.toString()
            val stopCommand = ProcessBuilder("docker", "rm", "-f", containerName)
                .redirectErrorStream(true)
                .start()
            stopCommand.waitFor()

            // 2. Убиваем сам процесс, если он ещё жив
            if (process.isAlive) {
                process.destroy()
                // На всякий случай, через секунду — жёсткое завершение
                if (!process.waitFor(1, TimeUnit.SECONDS)) {
                    process.destroyForcibly()
                }
            }

            _process = null
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // TODO Доставать ссылки на артефакты из s3
    private fun prepareArtifacts(): List<JobArtifactLink> {
        val libs = File("/tmp/builds/$id/out/lib").listFiles()
            .map { JobArtifactLink(it.absolutePath, ArtifactType.LIBRARY) }
            .toTypedArray()
        return listOf(
            *libs,
            JobArtifactLink("/tmp/$id/out/doc", ArtifactType.DOCUMENTATION)
        )
    }

    private companion object {

        fun JobParams.toRunParams(): String {
            return when (target) {
                JobTarget.COMPOSE,
                JobTarget.XML -> buildString {
                    append(" --name $name")
                    append(" --versionMajor ${version.major}")
                    append(" --versionMinor ${version.minor}")
                    append(" --versionPatch ${version.patch}")
                }
                JobTarget.IOS -> ""
                JobTarget.WEB -> buildString {
                    append(" --ds-name $name")
                    append(" --ds-version $version")
                    append(" --export-type tgz")
                    append(" --output /app/ds-generator/out")
                    append(" --token \"\${NPM_TOKEN}\"")
                }
            }
        }

        fun JobTarget.baseImage(): String {
            return when (this) {
                JobTarget.COMPOSE -> System.getenv("ANDROID_COMPOSE_RUNNER") ?: "plasma/android-runner-compose:dev"
                JobTarget.XML -> System.getenv("ANDROID_XML_RUNNER") ?: "plasma/android-runner:dev"
                JobTarget.WEB -> System.getenv("WEB_RUNNER") ?: "plasma/web-runner:dev"
                else -> throw IllegalArgumentException("Target $this is not supported")
            }
        }

        fun JobTarget.imageName(): String {
            return when (this) {
                JobTarget.COMPOSE -> "compose-publish:main"
                JobTarget.XML -> "xml-publish:main"
                JobTarget.IOS -> "ios-publish:main"
                JobTarget.WEB -> "web-publish:main"
            }
        }

        fun JobTarget.dockerfile(): String? {
            return when (this) {
                JobTarget.COMPOSE,
                JobTarget.XML -> "scripts/android_publish.Dockerfile"
                JobTarget.WEB -> null
                else -> throw IllegalArgumentException("Target $this is not supported")
            }
        }
    }
}