package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class PlatformDelegateRegistryTest {
    private val ios = FakePlatformDelegate(
        toolchain = ToolchainId("ios"),
        platforms = setOf(TargetPlatform.SWIFT_UI),
    )
    private val android = FakePlatformDelegate(
        toolchain = ToolchainId("android"),
        platforms = setOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW),
    )

    @Test
    fun emptyRegistryResolvesNothing() {
        val registry = PlatformDelegateRegistry(emptyList())

        assertNull(registry.forPlatform(TargetPlatform.COMPOSE))
        assertTrue(registry.all.isEmpty())
    }

    @Test
    fun delegateIsResolvedByEveryPlatformItDeclares() {
        val registry = PlatformDelegateRegistry(listOf(ios, android))

        assertSame(ios, registry.forPlatform(TargetPlatform.SWIFT_UI))
        assertSame(android, registry.forPlatform(TargetPlatform.COMPOSE))
        assertSame(android, registry.forPlatform(TargetPlatform.ANDROID_VIEW))
        assertNull(registry.forPlatform(TargetPlatform.REACT))
    }

    @Test
    fun registrationOrderIsPreserved() {
        val registry = PlatformDelegateRegistry(listOf(android, ios))

        assertEquals(listOf(ToolchainId("android"), ToolchainId("ios")), registry.all.map { it.toolchain })
    }

    @Test
    fun twoDelegatesMustNotClaimTheSamePlatform() {
        val duplicate = FakePlatformDelegate(
            toolchain = ToolchainId("ios-alt"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
        )

        val error = assertFailsWith<IllegalArgumentException> {
            PlatformDelegateRegistry(listOf(ios, duplicate))
        }

        assertTrue(error.message.orEmpty().contains("swiftui"), error.message)
        assertTrue(error.message.orEmpty().contains("ios-alt"), error.message)
    }

    @Test
    fun twoDelegatesMustNotShareToolchainId() {
        val duplicate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.REACT),
        )

        assertFailsWith<IllegalArgumentException> {
            PlatformDelegateRegistry(listOf(ios, duplicate))
        }
    }
}
