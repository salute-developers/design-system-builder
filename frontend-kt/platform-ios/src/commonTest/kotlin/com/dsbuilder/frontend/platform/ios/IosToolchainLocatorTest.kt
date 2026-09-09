package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class IosToolchainLocatorTest {
    private val managed = "/home/me/.dsbuilder/toolchains/ios/current"

    @Test
    fun overrideWinsOverEverything() {
        val locator = locator(
            environment = mapOf(IOS_TOOL_ENV to "/env/dsbuilder-ios"),
            existing = setOf("/override/dsbuilder-ios", "/env/dsbuilder-ios"),
        )

        assertEquals("/override/dsbuilder-ios", locator.locate("/override/dsbuilder-ios"))
    }

    @Test
    fun missingOverrideIsNotSilentlyReplaced() {
        val locator = locator(
            environment = mapOf(IOS_TOOL_ENV to "/env/dsbuilder-ios"),
            existing = setOf("/env/dsbuilder-ios"),
        )

        assertNull(locator.locate("/override/dsbuilder-ios"))
    }

    @Test
    fun environmentWinsOverManagedInstallAndPath() {
        val locator = locator(
            environment = mapOf(
                IOS_TOOL_ENV to "/env/dsbuilder-ios",
                "HOME" to "/home/me",
                "PATH" to "/usr/local/bin",
            ),
            existing = setOf(
                "/env/dsbuilder-ios",
                "$managed/dsbuilder-ios",
                "/usr/local/bin/dsbuilder-ios",
            ),
        )

        assertEquals("/env/dsbuilder-ios", locator.locate(null))
    }

    /**
     * Активную версию выбирает установщик и кладёт её в `current`; поиск не сортирует теги —
     * они датированные (`release-01-09-2026`), и порядок строк им не соответствует.
     */
    @Test
    fun managedInstallWinsOverPath() {
        val locator = locator(
            environment = mapOf("HOME" to "/home/me", "PATH" to "/usr/local/bin"),
            existing = setOf("$managed/dsbuilder-ios", "/usr/local/bin/dsbuilder-ios"),
        )

        assertEquals("$managed/dsbuilder-ios", locator.locate(null))
    }

    @Test
    fun installedVersionsAreIgnoredWithoutCurrent() {
        val locator = locator(
            environment = mapOf("HOME" to "/home/me", "PATH" to "/usr/local/bin"),
            existing = setOf(
                "/home/me/.dsbuilder/toolchains/ios/release-01-09-2026/dsbuilder-ios",
                "/usr/local/bin/dsbuilder-ios",
            ),
        )

        assertEquals("/usr/local/bin/dsbuilder-ios", locator.locate(null))
    }

    @Test
    fun pathIsTheLastResortAndKeepsItsOrder() {
        val locator = locator(
            environment = mapOf("PATH" to "/empty:/usr/local/bin:/opt/bin"),
            existing = setOf("/usr/local/bin/dsbuilder-ios", "/opt/bin/dsbuilder-ios"),
        )

        assertEquals("/usr/local/bin/dsbuilder-ios", locator.locate(null))
    }

    @Test
    fun nothingFoundWhenToolIsNowhere() {
        val locator = locator(environment = mapOf("PATH" to "/usr/local/bin"), existing = emptySet())

        assertNull(locator.locate(null))
    }

    @Test
    fun checkedLocationsNameEveryStepOfTheChain() {
        val locations = locator(environment = mapOf("HOME" to "/home/me"), existing = emptySet())
            .checkedLocations()

        assertTrue(locations.any { it.contains(IOS_TOOL_ENV) }, locations.toString())
        assertTrue(locations.any { it.contains(MANAGED_TOOLCHAIN_PATH) }, locations.toString())
        assertTrue(locations.any { it == "PATH" }, locations.toString())
    }

    private fun locator(
        environment: Map<String, String>,
        existing: Set<String>,
        directories: Map<String, List<String>> = emptyMap(),
    ) = IosToolchainLocator(
        fileSystem = FakeFileSystem(existing, directories),
        environmentReader = EnvironmentReader { name -> environment[name] },
    )
}

/**
 * Файловая система, у которой заданы только существующие пути и содержимое каталогов:
 * локатору больше ничего не нужно.
 */
internal class FakeFileSystem(
    private val existing: Set<String>,
    private val directories: Map<String, List<String>> = emptyMap(),
) : WorkspaceFileSystem {
    /** Созданные каталоги в порядке вызова. */
    val created: MutableList<String> = mutableListOf()

    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean = path in existing || path in directories

    override fun isDirectory(path: String): Boolean = path in directories

    override fun createDirectories(path: String) {
        created += path
    }

    override fun listFiles(path: String): List<String> = directories[path].orEmpty()

    override fun readText(path: String): String = ""

    override fun readBytes(path: String): ByteArray = byteArrayOf()

    override fun writeText(path: String, text: String) = Unit

    override fun writeBytes(path: String, bytes: ByteArray) = Unit

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) = Unit
}
