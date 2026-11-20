package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.data.PreviewPluginZipRead
import com.dsbuilder.frontend.feature.components.data.PreviewPluginZipReader
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PreviewPluginZipReaderTest {
    private val fs: dynamic = js("require('fs')")
    private val buffer: dynamic = js("Buffer")
    private val fflate: dynamic = js("require('fflate')")

    @Test
    fun preservesTheOriginalArchiveAndMetadataBytes() = withDirectory { directory ->
        val entries: dynamic = js("({})")
        entries["preview-plugin.json"] = buffer.from("{\"version\":\"a\"}")
        entries["api-meta.json"] = buffer.from("[1]")
        entries["вложенная папка/data.bin"] = buffer.from(arrayOf(0, 128, 255))
        val bytes: dynamic = fflate.zipSync(entries)
        val path = "$directory/plugin.zip"
        fs.writeFileSync(path, bytes)
        val read = assertIs<PreviewPluginZipRead.Content>(PreviewPluginZipReader().read(path))
        assertContentEquals(toBytes(bytes), read.value.zipBytes)
        assertContentEquals("{\"version\":\"a\"}".encodeToByteArray(), read.value.manifest)
        assertContentEquals("[1]".encodeToByteArray(), read.value.meta)
    }

    @Test
    fun rejectsMissingMetadataCorruptionAndUnsafePaths() = withDirectory { directory ->
        val path = "$directory/plugin.zip"
        val entries: dynamic = js("({})")
        entries["preview-plugin.json"] = buffer.from("{}")
        fs.writeFileSync(path, fflate.zipSync(entries))
        assertTrue(
            assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(path)).message.contains("api-meta"),
        )
        entries["api-meta.json"] = buffer.from("[]")
        entries["../unsafe"] = buffer.from("unexpected")
        fs.writeFileSync(path, fflate.zipSync(entries))
        assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(path))
        fs.writeFileSync(path, "not a zip")
        assertIs<PreviewPluginZipRead.Failed>(PreviewPluginZipReader().read(path))
    }

    private fun toBytes(bytes: dynamic) = ByteArray(bytes.length as Int) { (bytes[it] as Int).toByte() }

    private fun withDirectory(action: (String) -> Unit) {
        val directory = fs.mkdtempSync(js("require('os').tmpdir()") + "/dsbuilder-zip-") as String
        try { action(directory) } finally { fs.rmSync(directory, js("({recursive:true,force:true})")) }
    }
}
