package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

class PublicReadAccessPolicyTest {
    @Test
    fun `candidate grants only declared read and never a principal or admin`() {
        val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
        val id = UUID.randomUUID()
        val operation =
            DsReadOperation(
                "GET",
                "/api/design-systems/{designSystemId}",
                "design-systems:read",
                DsPublicReadKind.BOUNDARY,
            )
        val context = DsRequestContext(
            PublicReadCandidate(ProjectId("project"), id, operation),
            "test",
            designSystemId = id,
        )
        assertNull((context.access as? ProjectAccess)?.principal)
        assertFalse(context.globalAdmin)
        assertFalse(context.composePreviewPublisher)
        assertIs<DsResult.Success<Unit>>(policy.require(context, "design-systems:read"))
        assertEquals(DsResult.Failure(DsFailure.Forbidden), policy.require(context, "design-systems:write"))
        assertEquals(DsResult.Failure(DsFailure.Forbidden), policy.require(context, "projects:read"))
        val catalog = DsReadOperationCatalog(listOf(operation))
        assertEquals(operation, catalog.find("GET", "/api/design-systems/$id"))
        assertNull(catalog.find("POST", "/api/design-systems/$id"))
        assertNull(catalog.find("GET", "/api/design-systems/$id/events"))
    }

    @Test
    fun `catalog rejects ambiguous or incorrectly classified access declarations`() {
        val read = DsReadOperation(
            "GET",
            "/api/design-systems/{designSystemId}",
            "design-systems:read",
            DsPublicReadKind.BOUNDARY,
        )
        assertFailsWith<IllegalArgumentException> { DsReadOperationCatalog(listOf(read, read)) }
        assertFailsWith<IllegalArgumentException> {
            DsReadOperationCatalog(listOf(read.copy(method = "PATCH")))
        }
        assertFailsWith<IllegalArgumentException> {
            DsReadOperationCatalog(listOf(read.copy(kind = DsPublicReadKind.HISTORY)))
        }
        assertFailsWith<IllegalArgumentException> {
            DsReadOperationCatalog(emptyList(), setOf("/api/design-systems/{designSystemId}/tokens"))
        }
        val source = mutableListOf(read)
        val catalog = DsReadOperationCatalog(source)
        source.clear()
        assertEquals(listOf(read), catalog.operations)
    }
}
