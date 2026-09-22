package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DocumentationPublishPolicyTest {
    private val policy = DocumentationPublishPolicy()

    @Test fun `owner maintainer and editor may publish`() {
        listOf("owner", "maintainer", "editor").forEach { role ->
            assertTrue(policy.allows(actor(role)))
        }
    }

    @Test fun `viewer may not publish`() = assertFalse(policy.allows(actor("viewer")))

    @Test fun `project key requires exact write scope`() = assertTrue(
        policy.allows(
            ActorContext(
                ActorType.PROJECT_KEY,
                "key-1",
                "project-1",
                projectScopes = setOf("documentation:write"),
            ),
        ),
    )

    @Test fun `blank trusted project is invalid`() = assertFalse(
        policy.allows(ActorContext(ActorType.PROJECT_KEY, "key-1", "")),
    )

    private fun actor(role: String) = ActorContext(ActorType.USER, "user-1", "project-1", role)
}
