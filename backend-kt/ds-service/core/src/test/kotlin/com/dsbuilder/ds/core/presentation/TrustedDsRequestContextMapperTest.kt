package com.dsbuilder.ds.core.presentation

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import io.ktor.http.Headers
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class TrustedDsRequestContextMapperTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())

    @Test
    fun `missing revisions remain optional while zero and maximum long are accepted`() {
        val absent = assertNotNull(TrustedDsRequestContextMapper.map(headers(), evaluator))
        assertNull(absent.baseRevision)
        assertNull(absent.expectedCoreSelectionRevision)
        val explicit = assertNotNull(
            TrustedDsRequestContextMapper.map(
                headers("X-DS-Base-Revision" to "0", "X-DS-Core-Selection-Revision" to Long.MAX_VALUE.toString()),
                evaluator,
            ),
        )
        assertEquals(0L, explicit.baseRevision)
        assertEquals(Long.MAX_VALUE, explicit.expectedCoreSelectionRevision)
    }

    @Test
    fun `malformed Core and draft revisions reject the whole trusted context`() {
        val names = listOf("X-DS-Base-Revision", "X-DS-Core-Selection-Revision")
        val invalid = listOf("-1", "", "1.5", "invalid", "9223372036854775808")
        names.forEach { name ->
            invalid.forEach { raw ->
                assertNull(TrustedDsRequestContextMapper.map(headers(name to raw), evaluator), "$name=$raw")
            }
        }
    }

    private fun headers(vararg extra: Pair<String, String>) = Headers.build {
        append("X-Actor-Type", "user")
        append("X-Project-Id", "project")
        append("X-User-Id", "actor")
        append("X-System-Admin", "true")
        extra.forEach { (name, value) -> append(name, value) }
    }
}
