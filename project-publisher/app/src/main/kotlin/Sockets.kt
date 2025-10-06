import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.net.URL
import java.util.*
import java.util.zip.ZipInputStream
import kotlin.time.Duration.Companion.seconds

fun Application.configureSockets() {
    install(WebSockets) {
        pingPeriod = 30.seconds
        timeout = 90.seconds
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }
    routing {
        webSocket("/ws") { // websocketSession
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    val text = frame.readText()
                    outgoing.send(Frame.Text("YOU SAID: $text"))
                    if (text.equals("bye", ignoreCase = true)) {
                        close(CloseReason(CloseReason.Codes.NORMAL, "Client said BYE"))
                    }
                }
            }
        }
        webSocket("/build") {
            val first = incoming.receiveCatching().getOrNull() as? Frame.Text
                ?: return@webSocket close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "need JSON"))

            val params = Json.decodeFromString<BuildParams>(first.readText())
            val buildId = UUID.randomUUID().toString()

            downloadAndExtractPayloads(
                buildId,
                "https://github.com/salute-developers/theme-converter/raw/refs/heads/main/themes/${params.name}/${params.version}.zip",
                "https://github.com/salute-developers/theme-converter/raw/refs/heads/main/components/${params.name}/${params.version}-rc.zip"
            )


            val args = mutableListOf(
                "bash", "scripts/run_build_in_docker.sh",
                "--build-id", buildId,
                "--name", params.displayName,
                "--versionMajor", params.versionMajor,
                "--versionMinor", params.versionMinor,
                "--versionPatch", params.versionPatch,
                "--compose", params.compose.toString(),

            )
            // commands передадим как JSON одной переменной окружения
            val pb = ProcessBuilder(args).apply {
                redirectErrorStream(true)
                directory(File("/app"))
            }
            val process = pb.start()
            try {
                // Stream combined stdout/stderr to client as JSON lines (do blocking IO off the event loop)
                withContext(Dispatchers.IO) {
                    process.inputStream.bufferedReader().useLines { lines ->
                        lines.forEach { line ->
                            println(line)
                            outgoing.send(Frame.Text("""{"log":${Json.encodeToString(line)}}"""))
                        }
                    }
                }

                // Wait for completion and send exit code
                val exitCode = process.waitFor()
                outgoing.send(Frame.Text("""{"exitCode":$exitCode}"""))
            } finally {
                if (process.isAlive) process.destroyForcibly()
                close(CloseReason(CloseReason.Codes.NORMAL, "build finished"))
            }
        }
    }
}



private val wsJson = Json { ignoreUnknownKeys = true }

@Serializable
data class BuildParams(
    val name: String,
    val displayName: String,
    val version: String,
    val compose: Boolean,
)

private val BuildParams.versionMajor: String
    get() = version.split(".").first()

private val BuildParams.versionMinor: String
    get() = version.split(".")[1]

private val BuildParams.versionPatch: String
    get() = version.split(".").last()

private suspend fun downloadAndExtractPayloads(buildId: String, themeUrl: String, componentsUrl: String) {
    withContext(Dispatchers.IO) {
        val baseDir = File("/tmp/builds/$buildId/payloads/")
        val themeDir = File(baseDir, "theme")
        val componentsDir = File(baseDir, "components")

        themeDir.mkdirs()
        componentsDir.mkdirs()

        val themeZipFile = File(baseDir, "theme.zip")
        val componentsZipFile = File(baseDir, "components.zip")

        // Download theme.zip
        URL(themeUrl).openStream().use { input ->
            themeZipFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }

        // Download components.zip
        URL(componentsUrl).openStream().use { input ->
            componentsZipFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }
    }
}
