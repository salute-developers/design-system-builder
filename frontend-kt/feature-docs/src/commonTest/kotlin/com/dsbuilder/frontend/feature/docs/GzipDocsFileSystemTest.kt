package com.dsbuilder.frontend.feature.docs

import com.dsbuilder.frontend.feature.docs.data.GzipDocsFileSystem
import okio.Buffer
import okio.FileSystem
import okio.GzipSource
import okio.Path
import okio.Path.Companion.toPath
import okio.buffer
import okio.use
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GzipDocsFileSystemTest {

    @Test
    fun createTarGzArchivePackagesAllFilesAndDirectories() {
        withTempDirectory { tempRoot ->
            val docsDir = tempRoot / "docs"
            val contentCoreDir = docsDir / "content" / "core"
            val contentUserDir = docsDir / "content" / "user"
            val assetsDir = docsDir / "assets"
            listOf(contentCoreDir, contentUserDir, assetsDir).forEach(FileSystem.SYSTEM::createDirectories)

            write(docsDir / "structure-core.json", """{"schemaVersion":"1","navigation":[]}""")
            write(docsDir / "docs.json", """{"navigation":[]}""")
            write(docsDir / "manifest.json", """{"schemaVersion":"1"}""")
            write(contentCoreDir / "intro.md", "# Core intro")
            write(contentUserDir / "notes.md", "user-notes")
            write(assetsDir / "logo.png", "png-bytes")

            val gz = GzipDocsFileSystem(TestWorkspaceFileSystem(tempRoot.toString()))
            val bundlePath = tempRoot / "docs-bundle.tar.gz"
            gz.createTarGzArchive(docsDir.toString(), bundlePath.toString())

            val entries = readTarGzEntries(bundlePath.toString())

            assertTrue("docs.json" in entries, "Missing docs.json in archive: $entries")
            assertTrue("manifest.json" in entries, "Missing manifest.json in archive: $entries")
            assertTrue("content/core/" in entries, "Missing content/core/ dir in archive: $entries")
            assertTrue("content/core/intro.md" in entries, "Missing content/core/intro.md in archive: $entries")
            assertTrue("content/user/notes.md" in entries, "Missing content/user/notes.md in archive: $entries")
            assertTrue("assets/logo.png" in entries, "Missing assets/logo.png in archive: $entries")
        }
    }

    @Test
    fun createTarGzArchiveWritesCorrectFilePayload() {
        withTempDirectory { tempRoot ->
            val srcDir = tempRoot / "src"
            FileSystem.SYSTEM.createDirectories(srcDir)
            write(srcDir / "hello.txt", "hello-world")

            val gz = GzipDocsFileSystem(TestWorkspaceFileSystem(tempRoot.toString()))
            val outPath = tempRoot / "out.tar.gz"
            gz.createTarGzArchive(srcDir.toString(), outPath.toString())

            val payload = readTarGzFileContent(outPath.toString(), "hello.txt")
            assertEquals("hello-world", payload)
        }
    }

    @Test
    fun createTarGzArchiveFailsOnMissingSourceDirectory() {
        withTempDirectory { tempRoot ->
            val gz = GzipDocsFileSystem(TestWorkspaceFileSystem(tempRoot.toString()))
            val exception = assertFailsWith<IllegalArgumentException> {
                gz.createTarGzArchive(
                    (tempRoot / "missing").toString(),
                    (tempRoot / "out.tar.gz").toString(),
                )
            }
            assertTrue(exception.message!!.contains("not a directory"))
        }
    }

    @Test
    fun createTarGzArchiveHandlesLongUstarPathViaPrefix() {
        withTempDirectory { tempRoot ->
            val deepDir = tempRoot / "docs" / "assets" / "screenshots"
            FileSystem.SYSTEM.createDirectories(deepDir)
            // 100+ байт имени, должно попасть в ustar prefix
            val longName = "com_sdds_compose_uikit_fixtures_samples_navigationdrawer_NavigationDrawer_Collapsed.png"
            val payload = "png-bytes"
            write(deepDir / longName, payload)

            val gz = GzipDocsFileSystem(TestWorkspaceFileSystem(tempRoot.toString()))
            val outPath = tempRoot / "out.tar.gz"
            gz.createTarGzArchive((tempRoot / "docs").toString(), outPath.toString())

            val entries = readTarGzEntries(outPath.toString())
            val deep = "assets/screenshots/$longName"
            assertTrue(deep in entries, "Missing long-name entry in archive: $entries")
            assertEquals(payload, readTarGzFileContent(outPath.toString(), deep))
        }
    }

    private fun readTarGzEntries(path: String): List<String> {
        val entries = mutableListOf<String>()
        readTarGz(path) { name, _, _ -> entries += name }
        return entries
    }

    private fun readTarGzFileContent(path: String, targetName: String): String {
        var content: String? = null
        readTarGz(path) { name, _, payload ->
            if (name == targetName) {
                content = payload?.readUtf8()
            }
        }
        return content ?: error("Entry not found: $targetName")
    }

    @Suppress("NestedBlockDepth", "ComplexMethod")
    private inline fun readTarGz(
        path: String,
        block: (name: String, size: Long, payload: Buffer?) -> Unit,
    ) {
        val raw = FileSystem.SYSTEM.source(path.toPath()).buffer().use { it.readByteArray() }
        val gz = Buffer().write(raw)
        GzipSource(gz).buffer().use { source ->
            while (true) {
                val header = source.readByteArray(512)
                if (header.all { it == 0.toByte() }) break
                val tail = header.copyOfRange(0, 100).let { bytes ->
                    val end = bytes.indexOfFirst { it == 0.toByte() }
                    if (end < 0) bytes else bytes.copyOfRange(0, end)
                }.decodeToString()
                val prefix = header.copyOfRange(345, 500).let { bytes ->
                    val end = bytes.indexOfFirst { it == 0.toByte() }
                    if (end < 0) "" else bytes.copyOfRange(0, end).decodeToString()
                }
                val name = if (prefix.isEmpty()) tail else "$prefix/$tail"
                val sizeBytes = header.copyOfRange(124, 136)
                val sizeEnd = sizeBytes.indexOfFirst { it == 0.toByte() }
                val sizeStr = sizeBytes.copyOfRange(0, if (sizeEnd < 0) sizeBytes.size else sizeEnd)
                    .decodeToString().trim()
                val size = if (sizeStr.isEmpty()) 0L else sizeStr.toLong(8)
                val payload = if (size > 0) {
                    Buffer().write(source.readByteArray(size))
                } else {
                    null
                }
                val paddedSize = ((size + 511) / 512) * 512
                val padding = paddedSize - size
                if (padding > 0) {
                    source.skip(padding)
                }
                block(name, size, payload)
            }
        }
    }

    private fun write(path: Path, content: String) {
        FileSystem.SYSTEM.write(path) { writeUtf8(content) }
    }

    private fun withTempDirectory(block: (Path) -> Unit) {
        val root = FileSystem.SYSTEM_TEMPORARY_DIRECTORY / "dsbuilder-docs-${Random.nextLong()}"
        FileSystem.SYSTEM.createDirectories(root)
        try {
            block(root)
        } finally {
            FileSystem.SYSTEM.deleteRecursively(root, mustExist = false)
        }
    }
}
