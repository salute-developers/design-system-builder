package com.dsbuilder.ds.core.application

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame

class DsResultTest {
    @Test
    fun `failure returns unchanged before later work is executed`() {
        var executed = false
        fun step(input: DsResult<String>): DsResult<Int> {
            val value = input.valueOr { return it }
            executed = true
            return DsResult.Success(value.length)
        }
        val failure = DsResult.Failure(DsFailure.Conflict("specific_conflict"))
        assertSame(failure, step(failure))
        assertFalse(executed)
        assertEquals(DsResult.Success(3), step(DsResult.Success("abc")))
    }

    @Test
    fun `nullable success is not treated as failure`() {
        val input: DsResult<String?> = DsResult.Success(null)
        assertNull(input.valueOr { error("Success must not run the failure handler") })
    }
}
