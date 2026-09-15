package com.dsbuilder.frontend.platform.android

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AndroidGradleLocatorTest {
    @Test
    fun findsGradlewInTheWorkspaceDirectoryItself() {
        val locator = locator(existing = setOf("/repo/theme-module/gradlew"))

        assertEquals("/repo/theme-module/gradlew", locator.locate("/repo/theme-module", null))
    }

    @Test
    fun ascendsUntilItFindsGradlew() {
        val locator = locator(existing = setOf("/repo/gradlew"))

        assertEquals("/repo/gradlew", locator.locate("/repo/tokens/theme-module", null))
    }

    @Test
    fun nothingFoundWhenNoAncestorHasGradlew() {
        val locator = locator(existing = emptySet())

        assertNull(locator.locate("/repo/tokens/theme-module", null))
    }

    @Test
    fun overrideWinsWithoutSearching() {
        val locator = locator(existing = setOf("/repo/gradlew", "/custom/gradlew"))

        assertEquals("/custom/gradlew", locator.locate("/repo/tokens/theme-module", "/custom/gradlew"))
    }

    @Test
    fun missingOverrideIsNotSilentlyReplacedByAscendingSearch() {
        val locator = locator(existing = setOf("/repo/gradlew"))

        assertNull(locator.locate("/repo/tokens/theme-module", "/custom/gradlew"))
    }

    private fun locator(existing: Set<String>) = AndroidGradleLocator(fileSystem = FakeFileSystem(existing))
}

/**
 * Файловая система, у которой заданы только существующие пути: локатору больше ничего не нужно.
 */
internal class FakeFileSystem(
    private val existing: Set<String>,
) : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean = path in existing

    override fun isDirectory(path: String): Boolean = false

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String = ""

    override fun readBytes(path: String): ByteArray = byteArrayOf()

    override fun writeText(path: String, text: String) = Unit

    override fun writeBytes(path: String, bytes: ByteArray) = Unit

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) = Unit
}
