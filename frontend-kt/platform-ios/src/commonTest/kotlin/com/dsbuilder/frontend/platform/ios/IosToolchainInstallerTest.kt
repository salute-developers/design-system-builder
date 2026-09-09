package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class IosToolchainInstallerTest {
    private val root = "/home/me/.dsbuilder/toolchains/ios"
    private val unpacked = "$root/.staging/unpacked"

    @Test
    fun latestReleaseIsInstalledAndBecomesCurrent() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(requests = requests)

        val result = installer.install(ToolchainInstallRequest())

        val installed = assertIs<ToolchainInstallResult.Installed>(result)
        assertEquals("release-01-09-2026", installed.version)
        assertEquals("$root/release-01-09-2026/dsbuilder-ios", installed.executable)
        assertTrue(
            requests.any { it.executable == CURL && it.args.contains(DOWNLOAD_URL) },
            requests.toString(),
        )
        assertEquals(
            listOf("-s", "$root/release-01-09-2026", "$root/current"),
            requests.last { it.executable.endsWith("/ln") }.args,
        )
    }

    /**
     * Теги релизов — даты (`release-01-09-2026`), поэтому версию всегда называет ответ API,
     * а не сортировка строк на нашей стороне.
     */
    @Test
    fun requestedVersionIsAskedFromTheReleaseApi() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(requests = requests)

        installer.install(ToolchainInstallRequest(version = "release-19-08-2026"))

        assertTrue(
            requests.first().args.any { it.endsWith("/releases/tags/release-19-08-2026") },
            requests.first().args.toString(),
        )
    }

    /**
     * Регрессия: первая установка идёт на пустой машине, где каталога установок ещё нет,
     * а он же служит рабочей директорией запускаемых утилит — без него не стартует даже curl.
     */
    @Test
    fun installRootIsCreatedBeforeAnythingIsRun() {
        val fileSystem = FakeFileSystem(setOf("$unpacked/dsbuilder-ios"), mapOf(unpacked to emptyList()))
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(requests = requests, fileSystem = fileSystem)

        installer.install(ToolchainInstallRequest())

        assertEquals(root, fileSystem.created.first())
        assertTrue(requests.all { it.workingDirectory == root }, requests.map { it.workingDirectory }.toString())
    }

    @Test
    fun releaseWithoutToolAssetIsReportedWithItsTag() {
        val installer = installer(
            releaseBody = """{"tag_name":"release-01-09-2026","assets":[{"name":"SDDSComponents.xcframework.zip"}]}""",
        )

        val failed = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest()))

        assertTrue(failed.message.contains("release-01-09-2026"), failed.message)
        assertTrue(failed.message.contains(IOS_RELEASE_ASSET_PREFIX), failed.message)
    }

    @Test
    fun localArchiveIsInstalledWithoutContactingTheReleaseHost() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(
            requests = requests,
            existing = setOf("/tmp/dsbuilder-ios-cli-release-01-09-2026.zip", "$unpacked/dsbuilder-ios"),
        )

        val result = installer.install(
            ToolchainInstallRequest(archive = "/tmp/dsbuilder-ios-cli-release-01-09-2026.zip"),
        )

        assertEquals("release-01-09-2026", assertIs<ToolchainInstallResult.Installed>(result).version)
        assertTrue(requests.none { it.executable == CURL }, requests.toString())
    }

    @Test
    fun missingLocalArchiveIsReportedBeforeAnyProcessRuns() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(requests = requests, existing = emptySet())

        val result = installer.install(ToolchainInstallRequest(archive = "/tmp/absent.zip"))

        assertTrue(assertIs<ToolchainInstallResult.Failed>(result).message.contains("/tmp/absent.zip"))
        assertTrue(requests.isEmpty(), requests.toString())
    }

    /** Неудачная распаковка не должна оставлять `current`, указывающий на полупустое дерево. */
    @Test
    fun failedUnpackKeepsCurrentUntouched() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(
            requests = requests,
            runner = { request ->
                when {
                    request.executable.endsWith("/unzip") -> ProcessResult(exitCode = 1, output = "broken archive")
                    request.executable == CURL -> ProcessResult(exitCode = 0, output = RELEASE_BODY)
                    else -> ProcessResult(exitCode = 0, output = "")
                }
            },
        )

        val result = installer.install(ToolchainInstallRequest())

        assertTrue(assertIs<ToolchainInstallResult.Failed>(result).message.contains("broken archive"))
        assertTrue(requests.none { it.executable.endsWith("/ln") }, requests.toString())
    }

    @Test
    fun toolInsideANestedDirectoryIsFound() {
        val installer = installer(
            directories = mapOf(
                unpacked to listOf("$unpacked/dsbuilder-ios-cli"),
                "$unpacked/dsbuilder-ios-cli" to emptyList(),
            ),
            existing = setOf("$unpacked/dsbuilder-ios-cli/dsbuilder-ios"),
        )

        val result = installer.install(ToolchainInstallRequest())

        assertEquals(
            "$root/release-01-09-2026/dsbuilder-ios",
            assertIs<ToolchainInstallResult.Installed>(result).executable,
        )
    }

    @Test
    fun archiveWithoutTheToolIsReported() {
        val installer = installer(directories = emptyMap(), existing = emptySet())

        val failed = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest()))

        assertTrue(failed.message.contains(IOS_TOOL_EXECUTABLE), failed.message)
    }

    @Test
    fun installationWithoutHomeIsRefused() {
        val installer = installer(environment = emptyMap())

        val failed = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest()))

        assertTrue(failed.message.contains("HOME"), failed.message)
    }

    private fun installer(
        requests: MutableList<ProcessRequest> = mutableListOf(),
        runner: ProcessRunner? = null,
        releaseBody: String = RELEASE_BODY,
        environment: Map<String, String> = mapOf("HOME" to "/home/me"),
        existing: Set<String> = setOf("$unpacked/dsbuilder-ios"),
        directories: Map<String, List<String>> = mapOf(unpacked to emptyList()),
        fileSystem: FakeFileSystem = FakeFileSystem(existing, directories),
    ): IosToolchainInstaller {
        val recording = ProcessRunner { request ->
            requests += request
            runner?.run(request) ?: when (request.executable) {
                CURL -> ProcessResult(exitCode = 0, output = releaseBody)
                else -> ProcessResult(exitCode = 0, output = "")
            }
        }

        return IosToolchainInstaller(
            processRunner = recording,
            fileSystem = fileSystem,
            environmentReader = EnvironmentReader { name -> environment[name] },
            releaseSource = { workingDirectory ->
                IosReleaseSource(processRunner = recording, workingDirectory = workingDirectory)
            },
        )
    }

    private companion object {
        private const val DOWNLOAD_URL =
            "https://github.com/salute-developers/plasma-ios/releases/download/" +
                "release-01-09-2026/dsbuilder-ios-cli-release-01-09-2026.zip"

        private val RELEASE_BODY = """
            {
              "tag_name": "release-01-09-2026",
              "assets": [
                {"name": "SDDSComponents.xcframework.zip", "browser_download_url": "https://example.org/other.zip"},
                {"name": "dsbuilder-ios-cli-release-01-09-2026.zip", "browser_download_url": "$DOWNLOAD_URL"}
              ]
            }
        """.trimIndent()
    }
}
