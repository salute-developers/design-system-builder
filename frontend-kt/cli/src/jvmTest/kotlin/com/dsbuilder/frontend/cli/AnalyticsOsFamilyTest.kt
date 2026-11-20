package com.dsbuilder.frontend.cli

import kotlin.test.Test
import kotlin.test.assertEquals

class AnalyticsOsFamilyTest {
    @Test
    fun mapsSystemFamiliesWithoutVersionsOrDeviceData() {
        for ((name, family) in mapOf(
            "Windows 11" to "windows",
            "Windows Server 2022" to "windows",
            "Mac OS X" to "macos",
            "Darwin" to "macos",
            "Linux" to "linux",
            "FreeBSD" to "other",
        )) {
            assertEquals(family, jvmAnalyticsOs(name))
        }
    }
}
