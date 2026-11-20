package com.dsbuilder.ai.chat.presentation

import com.dsbuilder.ai.chat.domain.ChatRole
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ChatWireTest {
    @Test
    fun rolesRoundTripThroughTheSameWireNames() {
        ChatRole.entries.forEach { role ->
            val parsed = ChatWire.request(body(role.name.lowercase()), "key").messages.single()
            assertEquals(role, parsed.role)
            assertEquals(JsonPrimitive(role.name.lowercase()), ChatWire.message(parsed)["role"])
        }
    }

    @Test
    fun invalidRoleNamesAreNotNormalized() {
        listOf("USER", "Assistant", "other", "").forEach { role ->
            assertFailsWith<IllegalArgumentException> { ChatWire.request(body(role), "key") }
        }
    }

    private fun body(role: String): String =
        """{"designSystemId":"00000000-0000-0000-0000-000000000001","messages":[{"role":"$role","text":"hello"}]}"""
}
