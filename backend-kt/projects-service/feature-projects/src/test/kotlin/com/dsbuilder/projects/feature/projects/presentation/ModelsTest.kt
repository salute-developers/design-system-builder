package com.dsbuilder.projects.feature.projects.presentation

import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals

class ModelsTest {
    @Test
    fun `project response serializes every effective role`() {
        val project = Project(
            id = "project-1",
            name = "Workspace",
            description = null,
            status = ProjectStatus.ACTIVE,
            ownerUserId = "owner-1",
            createdAt = Instant.parse("2024-01-01T00:00:00Z"),
            updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
        )

        ProjectRole.entries.forEach { role ->
            assertEquals(role.name.lowercase(), project.toResponse(role).effectiveRole)
        }
    }
}
