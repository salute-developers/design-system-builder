package com.dsbuilder.frontend.runtime.node

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class NodeWorkspaceFileSystemTest {
    private val fs: dynamic = js("require('fs')")

    @Test
    fun missingThemePlatformDirectoriesAndRegularFilesHaveNoChildren() = temporaryDirectory { directory ->
        for (platform in listOf("android", "ios", "web")) {
            assertTrue(NodeWorkspaceFileSystem.listFiles("$directory/test_theme/$platform").isEmpty())
        }
        val file = NodeWorkspaceFileSystem.resolve(directory, "theme.json")
        fs.writeFileSync(file, "content")
        assertTrue(NodeWorkspaceFileSystem.listFiles(file).isEmpty())
        assertEquals("content", NodeWorkspaceFileSystem.readText(file))
    }

    @Test
    fun directoryListingReturnsOnlyAbsoluteDirectChildPaths() = temporaryDirectory { directory ->
        val child = NodeWorkspaceFileSystem.resolve(directory, "nested")
        val file = NodeWorkspaceFileSystem.resolve(directory, "тема.json")
        fs.mkdirSync(child)
        fs.writeFileSync(file, "{}")
        fs.writeFileSync(NodeWorkspaceFileSystem.resolve(child, "hidden.json"), "{}")
        assertEquals(setOf(child, file), NodeWorkspaceFileSystem.listFiles(directory).toSet())
    }

    @Test
    fun directoryListingPreservesPermissionAndUnexpectedIoFailures() {
        val original: dynamic = fs.readdirSync
        try {
            for (code in listOf("EACCES", "EIO")) {
                val failure: dynamic = js("new Error('filesystem failure')")
                failure.code = code
                fs.readdirSync = { _: dynamic -> throw failure }
                val caught = assertFailsWith<Throwable> { NodeWorkspaceFileSystem.listFiles("unreadable") }
                assertEquals(code, caught.asDynamic().code as String)
            }
        } finally { fs.readdirSync = original }
    }

    private fun temporaryDirectory(block: (String) -> Unit) {
        val directory = fs.mkdtempSync(js("require('os').tmpdir()") + "/dsbuilder-fs-") as String
        try { block(directory) } finally { fs.rmSync(directory, js("({recursive:true,force:true})")) }
    }
}
