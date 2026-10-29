package com.dsbuilder.ds.components.application

import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PluginArchiveTest {
    private fun zip(entries: List<Pair<String, ByteArray>>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            entries.forEach { (name, bytes) ->
                zip.putNextEntry(ZipEntry(name))
                zip.write(bytes)
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private fun invalid(bytes: ByteArray, limits: PluginArchiveLimits = PluginArchiveLimits()): String =
        assertIs<PluginArchiveResult.Invalid>(PluginArchiveReader.read(bytes, limits)).code

    @Test
    fun `a valid archive is unpacked with its digest`() {
        val bytes = zip(listOf("index.html" to "<html/>".toByteArray(), "composeResources/font/a.otf" to ByteArray(10)))
        val archive = assertIs<PluginArchiveResult.Valid>(PluginArchiveReader.read(bytes)).archive
        assertEquals(setOf("index.html", "composeResources/font/a.otf"), archive.files.keys)
        assertEquals(sha256Hex(bytes), archive.sha256)
        assertEquals(17L, archive.uncompressedBytes)
    }

    @Test
    fun `unsafe paths are rejected`() {
        listOf("../a", "/a", "a\\b", "a/../b", "./a", "a//b").forEach { path ->
            assertEquals("PLUGIN_ARCHIVE_UNSAFE_PATH", invalid(zip(listOf(path to ByteArray(1)))), path)
        }
    }

    @Test
    fun `duplicates, an empty archive and garbage are rejected`() {
        // ZipOutputStream refuses duplicate names itself, so the second name is patched in the produced bytes.
        val duplicated = zip(listOf("a1" to ByteArray(1), "a2" to ByteArray(1))).let { bytes ->
            String(bytes, Charsets.ISO_8859_1).replace("a2", "a1").toByteArray(Charsets.ISO_8859_1)
        }
        assertEquals("PLUGIN_ARCHIVE_DUPLICATE_PATH", invalid(duplicated))
        assertEquals("PLUGIN_ARCHIVE_INVALID", invalid(zip(emptyList())))
        assertEquals("PLUGIN_ARCHIVE_INVALID", invalid("not a zip".toByteArray()))
    }

    @Test
    fun `limits are enforced while reading`() {
        val big = zip(listOf("a" to ByteArray(1_000)))
        assertEquals("PLUGIN_ARCHIVE_TOO_LARGE", invalid(big, PluginArchiveLimits(maxCompressedBytes = 10)))
        assertEquals("PLUGIN_ARCHIVE_TOO_LARGE", invalid(big, PluginArchiveLimits(maxEntryBytes = 999)))
        assertEquals(
            "PLUGIN_ARCHIVE_TOO_LARGE",
            invalid(
                zip(listOf("a" to ByteArray(600), "b" to ByteArray(600))),
                PluginArchiveLimits(maxUncompressedBytes = 1_000),
            ),
        )
        assertEquals(
            "PLUGIN_ARCHIVE_TOO_MANY_FILES",
            invalid(zip(listOf("a" to ByteArray(1), "b" to ByteArray(1))), PluginArchiveLimits(maxEntries = 1)),
        )
        assertEquals(
            "PLUGIN_ARCHIVE_UNSAFE_PATH",
            invalid(zip(listOf("a".repeat(300) to ByteArray(1)))),
        )
    }

    @Test
    fun `a zip bomb is stopped by the entry limit instead of being unpacked in full`() {
        val bomb = zip(listOf("zeros.bin" to ByteArray(5_000_000)))
        assertTrue(bomb.size < 10_000)
        assertEquals("PLUGIN_ARCHIVE_TOO_LARGE", invalid(bomb, PluginArchiveLimits(maxEntryBytes = 1_000_000)))
    }
}
