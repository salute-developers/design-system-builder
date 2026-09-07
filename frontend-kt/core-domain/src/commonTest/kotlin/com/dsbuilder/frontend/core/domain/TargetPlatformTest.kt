package com.dsbuilder.frontend.core.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TargetPlatformTest {
    @Test
    fun everyPlatformRoundTripsThroughCliValue() {
        TargetPlatform.entries.forEach { platform ->
            assertEquals(platform, TargetPlatform.fromCliValue(platform.cliValue))
        }
    }

    @Test
    fun cliValuesAreCanonicalIdentifiers() {
        assertEquals(
            listOf("compose", "android-view", "swiftui", "react"),
            TargetPlatform.cliValues,
        )
    }

    @Test
    fun unknownOrAliasedValueIsRejected() {
        assertNull(TargetPlatform.fromCliValue("ios"))
        // uikit остаётся платформой документации, но собственного инструмента у неё нет.
        assertNull(TargetPlatform.fromCliValue("uikit"))
        assertNull(TargetPlatform.fromCliValue("SwiftUI"))
        assertNull(TargetPlatform.fromCliValue(""))
    }
}
