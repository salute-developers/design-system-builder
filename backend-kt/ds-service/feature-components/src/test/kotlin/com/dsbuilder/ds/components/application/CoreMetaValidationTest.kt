package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.data.coreMetaProjection
import com.dsbuilder.ds.components.domain.AliasDeprecation
import com.dsbuilder.ds.components.domain.ApiMetaAlias
import com.dsbuilder.ds.core.domain.CoreReleaseRef
import java.security.MessageDigest
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CoreMetaValidationTest {
    private val supported = setOf("color", "typography")

    @Test
    fun `empty array is a valid complete release`() {
        assertNull(CoreMetaValidation.error(command(emptyList()), supported))
    }

    @Test
    fun `hash is over original bytes including whitespace`() {
        val compact = command(emptyList())
        val spaced = compact.copy(sourceMetaBase64 = Base64.getEncoder().encodeToString("[ ]\n".toByteArray()))
        assertEquals("CORE_META_SHA256_MISMATCH", CoreMetaValidation.error(spaced, supported))
    }

    @Test
    fun `unsupported type rejects even an existing named property`() {
        val invalid = command(listOf(component("Button", "future-type")))
        assertTrue(requireNotNull(CoreMetaValidation.error(invalid, supported)).contains("Button.fill: future-type"))
    }

    @Test
    fun `contradicting definitions and aliases fail atomically`() {
        val a = component("Button", "color")
        assertTrue(
            requireNotNull(CoreMetaValidation.error(command(listOf(a, component("Button", "typography"))), supported))
                .startsWith("CORE_META_CONFLICTING_PROPERTY"),
        )
        val b = a.copy(
            properties = a.properties.map {
                it.copy(aliases = listOf(ApiMetaAlias("fill", AliasDeprecation.Deprecated("old"))))
            },
        )
        assertTrue(
            requireNotNull(CoreMetaValidation.error(command(listOf(a, b)), supported))
                .startsWith("CORE_META_CONFLICTING_PROPERTY"),
        )
    }

    @Test
    fun `normalization changes participate in release identity`() {
        val a = command(listOf(component("Button", "color")))
        val b = a.copy(components = listOf(component("Button", "typography")))
        assertNotEquals(coreMetaProjection(a), coreMetaProjection(b))
    }

    @Test
    fun `reordering entities does not change canonical projection`() {
        val components = listOf(component("Button", "color"), component("Card", "typography"))
        assertEquals(coreMetaProjection(command(components)), coreMetaProjection(command(components.reversed())))
    }

    @Test
    fun `system states need not be included in meta`() {
        assertNull(CoreMetaValidation.error(command(listOf(component("Button", "color"))), supported))
    }

    @Test
    fun `channel is mandatory and never inferred from version`() {
        val valid = command(emptyList())
        assertNull(CoreMetaValidation.error(valid.copy(channel = "dev"), supported))
        assertEquals("CORE_RELEASE_METADATA_REQUIRED", CoreMetaValidation.error(valid.copy(channel = null), supported))
        assertEquals(
            "CORE_RELEASE_INVALID_CHANNEL",
            CoreMetaValidation.error(valid.copy(channel = "latest"), supported),
        )
    }

    @Test
    fun `Android View source requires object with components while Compose keeps array`() {
        val valid = command(emptyList())
        val xml = valid.copy(platform = "xml", coreRelease = CoreReleaseRef("view-core", "xml", "1.0"))
        assertEquals("CORE_META_INVALID_SHAPE", CoreMetaValidation.error(xml, supported))
        val bytes = "{\"components\":[]}".toByteArray()
        assertNull(
            CoreMetaValidation.error(
                xml.copy(
                    sourceMetaBase64 = Base64.getEncoder().encodeToString(bytes),
                    metaSha256 = MessageDigest.getInstance("SHA-256").digest(bytes)
                        .joinToString("") { "%02x".format(it) },
                ),
                supported,
            ),
        )
    }

    private fun component(name: String, type: String) = ImportApiMeta.Component(
        name,
        listOf(ImportApiMeta.Property("fill", type, listOf(ApiMetaAlias("fill", AliasDeprecation.Current)), null)),
        emptyList(),
    )

    private fun command(components: List<ImportApiMeta.Component>): ImportApiMeta {
        val bytes = "[]".toByteArray()
        return ImportApiMeta(
            "compose",
            "api-meta.json",
            false,
            components,
            coreRelease = CoreReleaseRef("uikit-compose", "compose", "1.0"),
            sourceMetaBase64 = Base64.getEncoder().encodeToString(bytes),
            metaSha256 = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) },
            channel = "stable",
        )
    }
}
