package com.dsbuilder.settings.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TokenScopeCatalogTest {
    @Test fun `catalog exactly matches canonical scopes and has complete presentation`() {
        val scopes = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()).personalAccessTokenScopes()
        val catalog = tokenScopeCatalog(scopes)
        assertEquals(scopes.sorted(), catalog.map { it.id })
        assertTrue(catalog.all { it.title.isNotBlank() && it.description.isNotBlank() })
        assertTrue(setOf("documentation:read", "documentation:write").all { it in scopes })
    }
}
