package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class WebToolchainInstallerTest {
    private val npm = "/usr/local/bin/npm"
    private val prefix = "/home/me/.dsbuilder/toolchains/web"
    private val generator = "$prefix/bin/$WEB_GENERATOR_EXECUTABLE"

    @Test
    fun installsLatestIntoTheUserPrefixAndReportsTheVersion() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(runner = npmAnswering(requests, version = "0.3.1\n"))

        val result = assertIs<ToolchainInstallResult.Installed>(installer.install(ToolchainInstallRequest()))

        assertEquals(ToolchainId("web"), installer.toolchain)
        // Глобальный prefix npm часто принадлежит root: генератор ставится в каталог пользователя.
        assertEquals(
            listOf("install", "--global", "--prefix", prefix, "$WEB_GENERATOR_PACKAGE@latest"),
            requests.first().args,
        )
        assertEquals(npm, requests.first().executable)
        // npm печатает ход установки в терминал.
        assertTrue(requests.first().inheritStdio)
        assertEquals("0.3.1", result.version)
        assertEquals(generator, result.executable)
        assertEquals(listOf("--version"), requests.last().args)
    }

    @Test
    fun versionAndArchiveSelectWhatNpmInstalls() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(runner = npmAnswering(requests))

        installer.install(ToolchainInstallRequest(version = "1.2.3"))
        installer.install(ToolchainInstallRequest(archive = "./sddsjs-design-system-builder-generator-1.2.3.tgz"))

        val installs = requests.filter { it.args.first() == "install" }
        assertEquals("$WEB_GENERATOR_PACKAGE@1.2.3", installs[0].args.last())
        assertEquals("./sddsjs-design-system-builder-generator-1.2.3.tgz", installs[1].args.last())
        assertEquals("/project", installs[1].workingDirectory)
    }

    @Test
    fun missingNpmFailsWithoutStartingProcesses() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(runner = npmAnswering(requests), existing = emptySet())

        val message = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest())).message

        assertTrue(message.contains("Node.js 22+"), message)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun npmFailureKeepsTheCodeWithoutAdvisingToChangeNpmSettings() {
        val installer = installer(runner = { ProcessResult(exitCode = 243, output = "") })

        val message = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest())).message

        assertTrue(message.contains("243") && message.contains("dsbuilder toolchain install web"), message)
        assertTrue(!message.contains("config set prefix"), message)
    }

    @Test
    fun missingHomeFailsWithoutStartingProcesses() {
        val requests = mutableListOf<ProcessRequest>()
        val installer = installer(runner = npmAnswering(requests), home = null)

        val message = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest())).message

        assertTrue(message.contains("HOME"), message)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun windowsInstallsIntoUserProfile() {
        val requests = mutableListOf<ProcessRequest>()
        val windowsPrefix = "C:\\Users\\me\\.dsbuilder\\toolchains\\web"
        val windowsGenerator = "$windowsPrefix\\$WEB_GENERATOR_EXECUTABLE.cmd"
        val windowsNpm = "C:\\Program Files\\nodejs\\npm.cmd"
        val runner = ProcessRunner { request ->
            requests += request
            ProcessResult(exitCode = 0, output = if (request.executable == windowsGenerator) "0.1.0\n" else "")
        }
        val environment = mapOf("PATH" to "C:\\Program Files\\nodejs", "USERPROFILE" to "C:\\Users\\me")
        val locator = WebToolLocator(
            fileSystem = FakeFileSystem(setOf(windowsNpm, windowsGenerator), "C:\\project"),
            environmentReader = EnvironmentReader { environment[it] },
            processRunner = runner,
        )

        val result = WebToolchainInstaller(runner, locator).install(ToolchainInstallRequest())

        assertEquals(windowsGenerator, assertIs<ToolchainInstallResult.Installed>(result).executable)
        assertEquals(windowsPrefix, requests.first().args[3])
    }

    @Test
    fun installedButNotFoundIsReported() {
        val installer = installer(runner = npmAnswering(mutableListOf()), existing = setOf(npm))

        val message = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest())).message

        assertTrue(message.contains(WEB_GENERATOR_EXECUTABLE), message)
    }

    @Test
    fun launchFailureIsReported() {
        val installer = installer(runner = { throw ProcessLaunchException("permission denied") })

        val message = assertIs<ToolchainInstallResult.Failed>(installer.install(ToolchainInstallRequest())).message

        assertTrue(message.contains("permission denied"), message)
    }

    /** npm: установка успешна, `prefix -g` пуст; генератор отвечает версией. */
    private fun npmAnswering(requests: MutableList<ProcessRequest>, version: String = "0.1.0\n") =
        ProcessRunner { request ->
            requests += request
            ProcessResult(exitCode = 0, output = if (request.executable == generator) version else "")
        }

    private fun installer(
        runner: ProcessRunner,
        existing: Set<String> = setOf(npm, generator),
        home: String? = "/home/me",
    ): WebToolchainInstaller {
        val environment = listOfNotNull("PATH" to "/usr/bin:/usr/local/bin", home?.let { "HOME" to it }).toMap()
        val locator = WebToolLocator(
            fileSystem = FakeFileSystem(existing),
            environmentReader = EnvironmentReader { environment[it] },
            processRunner = runner,
        )
        return WebToolchainInstaller(processRunner = runner, locator = locator)
    }
}
