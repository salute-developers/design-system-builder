package com.dsbuilder.frontend.cli.feature.docs

import com.dsbuilder.frontend.cli.feature.docs.data.FilesystemPlatformContextReader
import kotlinx.serialization.json.Json
import okio.FileSystem
import okio.Path
import okio.SYSTEM
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class FilesystemPlatformContextReaderTest {
    @Test
    fun `reads artifact version from aggregator platform context`() = withTempDirectory { root ->
        val path = root / "platform-context.json"
        FileSystem.SYSTEM.write(path) {
            writeUtf8(
                """
                    {
                      "artifact": { "id": "sdds-sbcom-compose", "version": "0.12.0" },
                      "dependencies": { "uikitCompose": "0.50.0" },
                      "platform": "compose",
                      "theme": { "name": "Sdds SbCom" }
                    }
                """.trimIndent(),
            )
        }

        val context = reader(root).read(path.toString())

        requireNotNull(context)
        assertEquals("sdds-sbcom-compose", context.artifact.id)
        assertEquals("0.12.0", context.artifact.version)
        assertEquals("compose", context.platform)
    }

    @Test
    fun `returns null when platform context is absent`() = withTempDirectory { root ->
        assertNull(reader(root).read((root / "platform-context.json").toString()))
    }

    @Test
    fun `rejects blank artifact version`() = withTempDirectory { root ->
        val path = root / "platform-context.json"
        FileSystem.SYSTEM.write(path) {
            writeUtf8("""{"artifact":{"id":"artifact","version":""},"platform":"compose"}""")
        }

        assertFailsWith<IllegalArgumentException> { reader(root).read(path.toString()) }
    }

    private fun reader(root: Path) = FilesystemPlatformContextReader(
        TestCliFileSystem(root.toString()),
        Json { ignoreUnknownKeys = true },
    )

    private fun withTempDirectory(block: (Path) -> Unit) {
        val root = FileSystem.SYSTEM_TEMPORARY_DIRECTORY / "platform-context-${Random.nextLong()}"
        FileSystem.SYSTEM.createDirectories(root)
        try {
            block(root)
        } finally {
            FileSystem.SYSTEM.deleteRecursively(root, mustExist = false)
        }
    }
}
