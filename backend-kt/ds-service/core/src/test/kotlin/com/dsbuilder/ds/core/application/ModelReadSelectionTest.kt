package com.dsbuilder.ds.core.application

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ModelReadSelectionTest {
    @Test
    fun `absence and explicit draft select draft`() {
        assertEquals(DsResult.Success(ModelReadSelection.Draft), ModelReadSelection.parse(emptyList(), emptyList()))
        assertEquals(DsResult.Success(ModelReadSelection.Draft), ModelReadSelection.parse(listOf("draft"), emptyList()))
    }

    @Test
    fun `only exact semantic numbers and UUIDs are accepted`() {
        assertEquals(
            DsResult.Success(ModelReadSelection.Published("12.0.345")),
            ModelReadSelection.parse(listOf("12.0.345"), emptyList()),
        )
        val id = UUID.randomUUID()
        assertEquals(
            DsResult.Success(ModelReadSelection.ById(id)),
            ModelReadSelection.parse(emptyList(), listOf("$id")),
        )
        listOf("latest", "1.2", "01.2.3", "1.2.3-beta", "^1.2.3", " 1.2.3", "", "Draft").forEach {
            assertInvalid(ModelReadSelection.parse(listOf(it), emptyList()))
        }
        listOf("bad", "1-1-1-1-1", "").forEach {
            assertInvalid(ModelReadSelection.parse(emptyList(), listOf(it)))
        }
    }

    @Test
    fun `duplicate and conflicting selectors fail even when values match`() {
        val id = UUID.randomUUID().toString()
        assertInvalid(ModelReadSelection.parse(listOf("draft", "draft"), emptyList()))
        assertInvalid(ModelReadSelection.parse(emptyList(), listOf(id, id)))
        assertInvalid(ModelReadSelection.parse(listOf("draft"), listOf(id)))
    }

    private fun assertInvalid(result: DsResult<ModelReadSelection>) {
        val failure = assertIs<DsResult.Failure>(result)
        assertEquals("INVALID_QUERY", assertIs<DsFailure.InvalidRequest>(failure.error).code)
    }
}
