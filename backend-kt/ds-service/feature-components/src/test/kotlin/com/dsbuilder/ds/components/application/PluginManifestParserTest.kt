package com.dsbuilder.ds.components.application

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class PluginManifestParserTest {
    private val meta = """[{"componentName":"Avatar"}]"""
    private val commit = "0123456789abcdef0123456789abcdef01234567"

    private fun manifest(
        schemaVersion: String = "1",
        platform: String = "\"compose\"",
        protocolVersion: String = "1",
        commitValue: String = "\"$commit\"",
        version: String = "\"${commit.take(12)}\"",
        uikit: String = "\"0.55.0\"",
        metaSha: String = "\"${sha256Hex(meta.toByteArray())}\"",
        entrypoint: String = "\"index.html\"",
    ) = """{"schemaVersion":$schemaVersion,"platform":$platform,"protocolVersion":$protocolVersion,""" +
        """"commit":$commitValue,"version":$version,"uikitComposeVersion":$uikit,"apiMetaSha256":$metaSha,""" +
        """"entrypoint":$entrypoint}"""

    private fun archive(
        manifest: String = manifest(),
        files: Map<String, String> = mapOf("index.html" to "<html/>", "api-meta.json" to meta),
    ) = PluginArchive(
        (files + ("preview-plugin.json" to manifest)).mapValues { it.value.toByteArray() },
        compressedBytes = 1,
        sha256 = "0".repeat(64),
    )

    private fun code(archive: PluginArchive) = assertIs<PluginManifestResult.Invalid>(
        PluginManifestParser.parse(archive),
    ).code

    @Test
    fun `a consistent manifest is accepted`() {
        val result = assertIs<PluginManifestResult.Valid>(PluginManifestParser.parse(archive()))
        assertEquals(commit.take(12), result.manifest.version)
        assertEquals("0.55.0", result.manifest.uikitComposeVersion)
        assertEquals(1, result.manifest.protocolVersion)
    }

    @Test
    fun `required files are checked`() {
        assertEquals("PLUGIN_FILE_MISSING", code(archive(files = mapOf("api-meta.json" to meta))))
        assertEquals("PLUGIN_FILE_MISSING", code(archive(files = mapOf("index.html" to "<html/>"))))
    }

    @Test
    fun `manifest fields are validated`() {
        listOf(
            manifest(schemaVersion = "2"),
            manifest(platform = "\"xml\""),
            manifest(protocolVersion = "0"),
            manifest(protocolVersion = "\"1\""),
            manifest(commitValue = "\"short\""),
            manifest(uikit = "\"latest\""),
            manifest(metaSha = "\"ABC\""),
            "[]",
            "not json",
        ).forEach { assertEquals("PLUGIN_MANIFEST_INVALID", code(archive(it)), it) }
    }

    @Test
    fun `version must match the commit and the meta digest must match the file`() {
        assertEquals("PLUGIN_VERSION_COMMIT_MISMATCH", code(archive(manifest(version = "\"000000000000\""))))
        assertEquals("PLUGIN_META_SHA256_MISMATCH", code(archive(manifest(metaSha = "\"${"1".repeat(64)}\""))))
    }

    @Test
    fun `the entrypoint must exist in the archive`() {
        assertEquals("PLUGIN_ENTRYPOINT_MISSING", code(archive(manifest(entrypoint = "\"app.html\""))))
    }

    @Test
    fun `content types come from an explicit table`() {
        assertEquals("application/wasm", PluginContentTypes.forPath("a/b/app.wasm"))
        assertEquals("font/otf", PluginContentTypes.forPath("composeResources/font/s.OTF"))
        assertEquals("application/octet-stream", PluginContentTypes.forPath("composeResources/files/data.bin"))
        assertEquals("application/octet-stream", PluginContentTypes.forPath("noextension"))
    }
}
