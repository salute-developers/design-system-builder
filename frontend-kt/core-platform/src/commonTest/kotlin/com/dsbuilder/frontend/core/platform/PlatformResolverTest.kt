package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PlatformResolverTest {
    @Test
    fun explicitPlatformWinsOverConfig() {
        val resolution = PlatformResolver.resolve(
            explicit = TargetPlatform.SWIFT_UI,
            configured = listOf(TargetPlatform.COMPOSE),
        )

        assertEquals(TargetPlatform.SWIFT_UI, assertIs<PlatformResolution.Resolved>(resolution).platform)
    }

    @Test
    fun singleConfiguredPlatformIsUsed() {
        val resolution = PlatformResolver.resolve(explicit = null, configured = listOf(TargetPlatform.COMPOSE))

        assertEquals(TargetPlatform.COMPOSE, assertIs<PlatformResolution.Resolved>(resolution).platform)
    }

    @Test
    fun repeatedConfiguredPlatformIsStillSingle() {
        val resolution = PlatformResolver.resolve(
            explicit = null,
            configured = listOf(TargetPlatform.COMPOSE, TargetPlatform.COMPOSE),
        )

        assertEquals(TargetPlatform.COMPOSE, assertIs<PlatformResolution.Resolved>(resolution).platform)
    }

    @Test
    fun missingPlatformNamesBothWaysToSetIt() {
        val resolution = PlatformResolver.resolve(explicit = null, configured = emptyList())

        val message = assertIs<PlatformResolution.Failed>(resolution).message
        assertTrue(message.contains("--platform"), message)
        // Существующий проект нельзя переинициализировать: подсказка обязана называть и поле config.
        assertTrue(message.contains(".sdds/config.json"), message)
        assertTrue(message.contains("swiftui"), message)
    }

    @Test
    fun severalConfiguredPlatformsRequireExplicitChoice() {
        val resolution = PlatformResolver.resolve(
            explicit = null,
            configured = listOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW),
        )

        val message = assertIs<PlatformResolution.Failed>(resolution).message
        assertTrue(message.contains("compose"), message)
        assertTrue(message.contains("android-view"), message)
        assertTrue(message.contains("--platform"), message)
    }
}
