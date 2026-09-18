package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.DesignSystemSelection
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DesignSystemLinkTest {
    @Test
    fun canonicalLinkRoundTrips() {
        val selection = DesignSystemSelection(
            ProjectId("project-1"),
            DesignSystemId("ds_1"),
            "1.2.3",
            TargetPlatform.COMPOSE,
        )
        val link = DesignSystemLink.format(selection)
        assertEquals("dsbuilder://projects/project-1/design-systems/ds_1?version=1.2.3&platform=compose", link)
        assertEquals(selection, DesignSystemLink.parse(link))
    }

    @Test
    fun invalidLinksCannotFallBackToWorkspace() {
        listOf(
            "https://example.com/projects/a/design-systems/b?version=1&platform=compose",
            "dsbuilder://user@projects/a/design-systems/b?version=1&platform=compose",
            "dsbuilder://projects/a/design-systems/b?version=1&version=2&platform=compose",
            "dsbuilder://projects/a/design-systems/b?version=1&platform=compose#part",
            "dsbuilder://projects/a/design-systems/b?version=1&platform=web",
            "dsbuilder://projects/a/design-systems/b?platform=compose",
            "dsbuilder://projects/a%2Fb/design-systems/c?version=1&platform=compose",
            "dsbuilder://projects/a/design-systems/b?version=1&platform=compose&token=secret",
        ).forEach { assertNull(DesignSystemLink.parse(it), it) }
    }
}
