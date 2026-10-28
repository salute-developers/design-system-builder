package com.dsbuilder.app.presentation

import kotlin.test.Test
import kotlin.test.assertEquals

class ProxyTrustTest {
    @Test
    fun `only the explicitly trusted proxy chain supplies client identity`() {
        val trust = ProxyTrust(listOf("10.0.0.0/8"))
        assertEquals("192.0.2.10", trust.clientAddress("192.0.2.10", "198.51.100.10"))
        assertEquals("198.51.100.10", trust.clientAddress("10.0.0.2", "198.51.100.10, 10.0.0.1"))
        assertEquals("10.0.0.2", trust.clientAddress("10.0.0.2", "invalid.example"))
        assertEquals("10.0.0.2", ProxyTrust(emptyList()).clientAddress("10.0.0.2", "198.51.100.10"))
    }
}
