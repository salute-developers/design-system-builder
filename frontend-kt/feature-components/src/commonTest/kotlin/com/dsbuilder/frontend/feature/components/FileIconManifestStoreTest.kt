package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.application.IconManifestReadResult
import com.dsbuilder.frontend.feature.components.data.FileIconManifestStore
import com.dsbuilder.frontend.feature.components.data.IconSvgMetadata
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FileIconManifestStoreTest {
    private fun svg(metadata: String? = null) =
        "<svg xmlns=\"http://www.w3.org/2000/svg\">" +
            (metadata?.let { "<metadata>$it</metadata>" }.orEmpty()) + "<path d=\"M0 0\"/></svg>"

    private val addMetadata = """{"aliases":["add","добавить"],"category":"Actions &amp; Feedback"}"""

    private fun system(files: Map<String, String>, vararg directories: String) =
        InMemoryWorkspaceFileSystem("/work", files).also { it.directories += directories }

    private fun read(
        fileSystem: InMemoryWorkspaceFileSystem,
        path: String = "/icons",
        version: String? = null,
    ) = FileIconManifestStore(fileSystem).fromDirectory(path, version)

    private fun IconManifestReadResult.read(): IconManifestReadResult.Read = assertIs(this)

    private fun IconManifestReadResult.failure(): String = assertIs<IconManifestReadResult.Failed>(this).message

    @Test
    fun buildsAllThreeSizesAndTheMetadataOfSize24() {
        val fileSystem = system(
            mapOf(
                "/icons/svg/16/AddOutline.svg" to svg(),
                "/icons/svg/24/AddOutline.svg" to svg(addMetadata),
                "/icons/svg/36/AddOutline.svg" to svg(),
                "/icons/package.json" to """{"name":"@salutejs/sdds-icons","version":"0.14.0"}""",
            ),
            "/icons",
            "/icons/svg",
            "/icons/svg/16",
            "/icons/svg/24",
            "/icons/svg/36",
        )

        val result = read(fileSystem).read()

        val icon = result.manifest.icons.single()
        assertEquals("AddOutline", icon.name)
        assertEquals(listOf(16, 24, 36), icon.sizes.keys.toList())
        assertEquals("Actions & Feedback", icon.category)
        assertEquals(listOf("add", "добавить"), icon.aliases)
        assertEquals("@salutejs/sdds-icons", result.manifest.source.packageName)
        assertEquals("0.14.0", result.manifest.source.version)
        assertTrue(result.warnings.none { it.contains("no size") }, result.warnings.toString())
    }

    @Test
    fun anIncompleteSetOfSizesIsAWarningNotAnError() {
        val fileSystem = system(
            mapOf("/icons/svg/24/NewFill.svg" to svg(addMetadata)),
            "/icons",
            "/icons/svg/24",
        )

        val result = read(fileSystem).read()

        assertEquals(listOf(24), result.manifest.icons.single().sizes.keys.toList())
        assertTrue(result.warnings.any { it.startsWith("NewFill has no size 16, 36") }, result.warnings.toString())
    }

    @Test
    fun theVersionOptionBeatsPackageJsonAndUnknownIsUsedWithoutBoth() {
        val files = mapOf(
            "/icons/svg/24/AddOutline.svg" to svg(addMetadata),
            "/icons/package.json" to """{"version":"0.14.0"}""",
        )
        val withoutPackageJson = system(files - "/icons/package.json", "/icons", "/icons/svg/24")

        assertEquals(
            "1.2.3",
            read(system(files, "/icons", "/icons/svg/24"), version = "1.2.3").read().manifest.source.version,
        )
        assertEquals("unknown", read(withoutPackageJson).read().manifest.source.version)
    }

    @Test
    fun noSizeDirectoriesFailAndNameThePath() {
        val message = read(system(emptyMap(), "/icons")).failure()

        assertTrue(message.contains("/icons") && message.contains("svg/24"), message)
    }

    @Test
    fun anEmptyCatalogFails() {
        val message = read(system(emptyMap(), "/icons", "/icons/svg/24")).failure()

        assertTrue(message.contains("no SVG files"), message)
    }

    @Test
    fun aTooLargeSvgFailsAndNamesTheFile() {
        val big = "<svg>" + "a".repeat(64 * 1024) + "</svg>"
        val message = read(system(mapOf("/icons/svg/24/BigFill.svg" to big), "/icons", "/icons/svg/24")).failure()

        assertTrue(message.contains("/icons/svg/24/BigFill.svg"), message)
    }

    @Test
    fun filesWithoutSvgExtensionAndNestedDirectoriesAreIgnored() {
        val fileSystem = system(
            mapOf(
                "/icons/svg/24/AddOutline.svg" to svg(addMetadata),
                "/icons/svg/24/README.md" to "text",
                "/icons/svg/24/Nested" to "dir",
            ),
            "/icons",
            "/icons/svg/24",
            "/icons/svg/24/Nested",
        )

        assertEquals(listOf("AddOutline"), read(fileSystem).read().manifest.icons.map { it.name })
    }

    @Test
    fun missingMetadataGivesAnIconWithoutCategoryAndAliasesAndAWarning() {
        val result = read(system(mapOf("/icons/svg/24/AddOutline.svg" to svg()), "/icons", "/icons/svg/24")).read()

        val icon = result.manifest.icons.single()
        assertNull(icon.category)
        assertEquals(emptyList(), icon.aliases)
        assertTrue(
            result.warnings.any { it.contains("AddOutline") && it.contains("metadata") },
            result.warnings.toString(),
        )
    }

    @Test
    fun differentMetadataBetweenSizesUsesSize24WithAWarning() {
        val fileSystem = system(
            mapOf(
                "/icons/svg/16/AddOutline.svg" to svg("""{"aliases":["x"],"category":"Other"}"""),
                "/icons/svg/24/AddOutline.svg" to svg(addMetadata),
            ),
            "/icons",
            "/icons/svg/16",
            "/icons/svg/24",
        )

        val result = read(fileSystem).read()

        assertEquals("Actions & Feedback", result.manifest.icons.single().category)
        assertTrue(
            result.warnings.any { it.contains("AddOutline") && it.contains("different") },
            result.warnings.toString(),
        )
    }

    @Test
    fun metadataFallsBackToTheFirstSizeWithoutSize24() {
        val fileSystem = system(
            mapOf("/icons/svg/16/AddOutline.svg" to svg(addMetadata)),
            "/icons",
            "/icons/svg/16",
        )

        assertEquals("Actions & Feedback", read(fileSystem).read().manifest.icons.single().category)
    }

    @Test
    fun xmlEntitiesAreDecoded() {
        assertEquals(
            "A & B <c> \"d\" 'e' A",
            IconSvgMetadata.decode("A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos; &#65;"),
        )
        assertEquals("A", IconSvgMetadata.decode("&#x41;"))
    }

    @Test
    fun manifestRoundTripsThroughAFile() {
        val fileSystem = system(
            mapOf("/icons/svg/24/AddOutline.svg" to svg(addMetadata)),
            "/icons",
            "/icons/svg/24",
        )
        val store = FileIconManifestStore(fileSystem)
        val built = store.fromDirectory("/icons", "0.14.0").read().manifest

        assertNull(store.write("/work/icons-manifest.json", built))
        val read = store.fromManifest("/work/icons-manifest.json").read().manifest

        assertEquals(built, read)
        assertTrue(fileSystem.files.getValue("/work/icons-manifest.json").contains("\"schemaVersion\":1"))
    }

    @Test
    fun aMissingOrBrokenManifestFailsWithThePath() {
        val fileSystem = system(
            mapOf(
                "/work/bad.json" to "{not json",
                "/work/empty.json" to """{"schemaVersion":1,"icons":[]}""",
                "/work/old.json" to """{"schemaVersion":2,"icons":[]}""",
                "/work/size.json" to """{"schemaVersion":1,"icons":[{"name":"AddOutline","sizes":{"20":"<svg/>"}}]}""",
            ),
        )
        val store = FileIconManifestStore(fileSystem)

        listOf("/work/missing.json", "/work/bad.json", "/work/empty.json", "/work/old.json", "/work/size.json")
            .forEach { path ->
                val message = store.fromManifest(path).failure()
                assertTrue(message.contains(path), message)
            }
    }
}
