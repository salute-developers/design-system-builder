package com.dsbuilder.ds.core.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CoreReleaseRefTest {
    @Test
    fun `producer aliases select their canonical platform without changing coordinates`() {
        val aliases = mapOf(
            "web" to "web",
            "react" to "web",
            "compose" to "compose",
            "xml" to "xml",
            "android-view" to "xml",
            "ios" to "ios",
            "swiftui" to "ios",
            "uikit" to "ios",
        )
        aliases.forEach { (alias, canonical) ->
            val ref = CoreReleaseRef("library", alias, "1.0.0")
            assertEquals(canonical, CoreReleaseRef.canonicalPlatform(alias))
            assertTrue(ref.valid())
            assertEquals(alias, ref.platform)
        }
    }

    @Test
    fun `unknown spelling and blank coordinates are rejected`() {
        listOf("", "android", "Compose", " web ").forEach { platform ->
            assertNull(CoreReleaseRef.canonicalPlatform(platform))
            assertFalse(CoreReleaseRef("library", platform, "1.0.0").valid())
        }
        assertFalse(CoreReleaseRef(" ", "compose", "1.0.0").valid())
        assertFalse(CoreReleaseRef("library", "compose", " ").valid())
    }
}
