package com.dsbuilder.settings.data

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class Sha256TokenSecretManagerTest {
    @Test fun `new hashes and existing PBKDF2 hashes verify correctly`() {
        val manager = Sha256TokenSecretManager()
        val secret = manager.generate()
        val hash = manager.hash(secret)
        assertTrue(hash.startsWith("sha256:"))
        assertTrue(manager.verify(secret, hash))
        assertFalse(manager.verify(secret + "wrong", hash))
        assertFalse(manager.verify(secret, "sha256:!invalid"))
        val legacyHash = Pbkdf2TokenSecretManager(iterations = 1).hash(secret)
        assertTrue(manager.verify(secret, legacyHash))
        assertFalse(manager.verify(secret + "wrong", legacyHash))
    }
}
