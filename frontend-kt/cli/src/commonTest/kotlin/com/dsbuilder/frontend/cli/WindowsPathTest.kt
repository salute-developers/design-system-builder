package com.dsbuilder.frontend.cli

import kotlin.test.Test
import kotlin.test.assertEquals

class WindowsPathTest {
    @Test
    fun keepsDriveRootAndResolvesDotSegments() {
        assertEquals("C:\\", normalizedAbsoluteWindowsPath("C:\\", "D:\\work"))
        assertEquals("C:\\project\\.sdds", normalizedAbsoluteWindowsPath("C:\\work\\..\\project\\.sdds", "D:\\work"))
        assertEquals("C:\\root\\file", normalizedAbsoluteWindowsPath("/root/file", "C:\\work"))
    }

    @Test
    fun keepsUncShareRoot() {
        assertEquals("\\\\server\\share", normalizedAbsoluteWindowsPath("\\\\server\\share", "C:\\work"))
        assertEquals(
            "\\\\server\\share\\project",
            normalizedAbsoluteWindowsPath("\\\\server\\share\\work\\..\\project", "C:\\work"),
        )
    }
}
