@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSFileManager
import platform.Foundation.NSUUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class MacosAnalyticsIdentityTest {
    @Test fun parallelProcessesModesAndNewVersionsKeepOneIdentity() = runBlocking {
        val root = "/tmp/dsbuilder-analytics-${NSUUID().UUIDString}"
        val fs = object : CredentialStoreFileSystem by MacosCredentialStoreFileSystem {
            override fun homeDirectory(): String = root
        }
        try {
            val ids = (1..16).map {
                async(Dispatchers.Default) {
                    CliMetricaIdentityStore(fs, MacosCredentialStoreLock).getOrCreateInstallationId()
                }
            }.awaitAll()
            assertEquals(1, ids.toSet().size)
            assertTrue(ids.first().toLong() > 0)
            assertEquals(ids.first(), CliMetricaIdentityStore(fs, MacosCredentialStoreLock).getOrCreateInstallationId())
            val state = "$root/.dsbuilder/analytics/installation-id"
            assertEquals("1:${ids.first()}", fs.readText(state))
            fs.writeText(state, "corrupt")
            assertFailsWith<IllegalArgumentException> {
                CliMetricaIdentityStore(fs, MacosCredentialStoreLock).getOrCreateInstallationId()
            }
            assertEquals("corrupt", fs.readText(state))
        } finally { NSFileManager.defaultManager.removeItemAtPath(root, null) }
    }
}
