package com.dsbuilder.ds.app

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import io.ktor.http.headersOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class TrustedDsRequestContextMapperTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())

    @Test
    fun `uses authorization core principal and policy`() {
        val context = TrustedDsRequestContextMapper.map(
            headersOf(
                "X-Actor-Type" to listOf("user"),
                "X-User-Id" to listOf("user-1"),
                "X-Project-Id" to listOf("project-1"),
                "X-Project-Role" to listOf("viewer"),
                "X-System-Admin" to listOf("false"),
                "X-Correlation-Id" to listOf("correlation-1"),
            ),
            evaluator,
        )!!

        assertEquals("project-1", context.projectId.value)
        assertEquals("correlation-1", context.correlationId)
        assertIs<DsResult.Success<Unit>>(DsAccessPolicy(evaluator).require(context, "design-systems:read"))
        assertEquals(
            DsFailure.Forbidden,
            assertIs<DsResult.Failure>(DsAccessPolicy(evaluator).require(context, "design-systems:write")).error,
        )
    }

    @Test
    fun `rejects incomplete trusted context`() {
        assertNull(TrustedDsRequestContextMapper.map(headersOf("X-Project-Id", listOf("project-1")), evaluator))
    }
}
