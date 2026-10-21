package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.data.PreviewPluginZipRead
import com.dsbuilder.frontend.feature.components.data.PreviewPluginZipReader
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PreviewPluginZipReaderTest {
    private fun zip(entries: Map<String, String>): File {
        val file = File.createTempFile("plugin-", ".zip").apply { deleteOnExit() }
        ZipOutputStream(file.outputStream()).use { zip ->
            entries.forEach { (name, text) ->
                zip.putNextEntry(ZipEntry(name))
                zip.write(text.encodeToByteArray())
                zip.closeEntry()
            }
        }
        return file
    }

    @Test
    fun readsTheArchiveBytesTheManifestAndTheMeta() {
        val file = zip(
            mapOf("index.html" to "<html/>", "preview-plugin.json" to """{"version":"a"}""", "api-meta.json" to "[1]"),
        )

        val read = assertIs<PreviewPluginZipRead.Content>(PreviewPluginZipReader().read(file.absolutePath))

        assertEquals("""{"version":"a"}""", read.value.manifest.decodeToString())
        assertEquals("[1]", read.value.meta.decodeToString())
        assertEquals(file.readBytes().toList(), read.value.zipBytes.toList())
    }

    @Test
    fun aMissingManifestOrMetaNamesTheFile() {
        val noMeta = zip(mapOf("preview-plugin.json" to "{}"))
        val noManifest = zip(mapOf("api-meta.json" to "[]"))

        assertTrue(
            assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(noMeta.absolutePath)).message
                .contains("api-meta.json"),
        )
        assertTrue(
            assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(noManifest.absolutePath)).message
                .contains("preview-plugin.json"),
        )
    }

    @Test
    fun aFileThatIsNotAZipAndAMissingFileFailWithTheirPath() {
        val text = File.createTempFile("plugin-", ".zip").apply {
            deleteOnExit()
            writeText("not a zip")
        }
        val missing = File(text.parentFile, "missing-${text.name}")

        val notZip = assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(text.absolutePath))
        val absent = assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(missing.absolutePath))

        assertTrue(notZip.message.contains(text.absolutePath), notZip.message)
        assertTrue(absent.message.contains(missing.absolutePath), absent.message)
    }
}
