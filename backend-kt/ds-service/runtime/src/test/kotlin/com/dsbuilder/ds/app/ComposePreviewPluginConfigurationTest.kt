package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Хранилище web настраивается поверх общих `DS_PLUGIN_*` и считается настроенным только целиком. */
class ComposePreviewPluginConfigurationTest {
    private val shared = mapOf(
        "DS_PLUGIN_S3_ENDPOINT" to "http://minio:9000",
        "DS_PLUGIN_S3_BUCKET" to "plugins",
        "DS_PLUGIN_S3_ACCESS_KEY" to "key",
        "DS_PLUGIN_S3_SECRET_KEY" to "secret",
        "DS_PLUGIN_S3_PREFIX" to "design-system-builder/compose-preview",
        "DS_PLUGIN_PUBLIC_BASE_URL" to "https://cdn.example.test/design-system-builder/compose-preview",
        "DS_PLUGIN_KEEP_BUILDS" to "2",
    )
    private val web = mapOf(
        "DS_WEB_PLUGIN_S3_BUCKET" to "plugins",
        "DS_WEB_PLUGIN_S3_PREFIX" to "design-system-builder/web-preview",
        "DS_WEB_PLUGIN_PUBLIC_BASE_URL" to "https://cdn.example.test/design-system-builder/web-preview",
    )

    @Test
    fun `the web storage takes its own location and the shared settings`() {
        val configuration = ComposePreviewPluginConfiguration.fromEnvironment(shared + web)

        assertTrue(configuration.configured(PreviewPluginPlatform.COMPOSE))
        assertTrue(configuration.configured(PreviewPluginPlatform.WEB))
        val settings = configuration.settings(PreviewPluginPlatform.WEB)
        assertEquals(
            "https://cdn.example.test/design-system-builder/web-preview/builds/0123456789ab/",
            settings.pluginUrl("0123456789ab"),
        )
        assertEquals(2, settings.keepBuilds)
        assertEquals(configuration.limits, settings.limits)
    }

    @Test
    fun `the web storage is configured only as a whole`() {
        web.keys.forEach { missing ->
            val configuration = ComposePreviewPluginConfiguration.fromEnvironment(shared + web - missing)
            val expected = missing == "DS_WEB_PLUGIN_S3_PREFIX"
            assertEquals(expected, configuration.configured(PreviewPluginPlatform.WEB), missing)
            assertTrue(configuration.configured(PreviewPluginPlatform.COMPOSE), missing)
        }
        val noKeys = ComposePreviewPluginConfiguration.fromEnvironment(shared + web - "DS_PLUGIN_S3_SECRET_KEY")
        assertFalse(noKeys.configured(PreviewPluginPlatform.WEB))
        // Compose does not depend on the web storage
        assertFalse(ComposePreviewPluginConfiguration.fromEnvironment(shared).configured(PreviewPluginPlatform.WEB))
    }

    @Test
    fun `a web storage overlapping the Compose builds is not configured`() {
        listOf("design-system-builder/compose-preview", "design-system-builder/compose-preview/builds/x").forEach {
            val configuration = ComposePreviewPluginConfiguration.fromEnvironment(
                shared + web + ("DS_WEB_PLUGIN_S3_PREFIX" to it),
            )
            assertFalse(configuration.configured(PreviewPluginPlatform.WEB), it)
        }
        val otherBucket = ComposePreviewPluginConfiguration.fromEnvironment(
            shared + web + ("DS_WEB_PLUGIN_S3_BUCKET" to "web-preview") +
                ("DS_WEB_PLUGIN_S3_PREFIX" to "design-system-builder/compose-preview"),
        )
        assertTrue(otherBucket.configured(PreviewPluginPlatform.WEB))
    }
}
