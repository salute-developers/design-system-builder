package com.dsbuilder.projects.feature.projects.data.local

import com.dsbuilder.projects.feature.projects.data.local.db.ProjectAccessKeysTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectMembersTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectsTable
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.Instant
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ExposedProjectRepositoryTest {
    private lateinit var repository: ExposedProjectRepository

    @BeforeTest
    fun setUp() {
        Database.connect(
            url = "jdbc:h2:mem:test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
            driver = "org.h2.Driver",
        )
        transaction {
            SchemaUtils.drop(ProjectAccessKeysTable, ProjectMembersTable, ProjectsTable)
            SchemaUtils.create(ProjectsTable, ProjectMembersTable, ProjectAccessKeysTable)
        }
        repository = ExposedProjectRepository()
    }

    @Test
    fun `stores and reads project with members`() = kotlinx.coroutines.runBlocking {
        val project = Project(
            id = "project-1",
            name = "Workspace",
            description = "Main",
            status = ProjectStatus.ACTIVE,
            ownerUserId = "owner-1",
            createdAt = Instant.parse("2024-01-01T00:00:00Z"),
            updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
        )
        val member = ProjectMember(
            projectId = "project-1",
            userId = "editor-1",
            role = ProjectRole.EDITOR,
            createdAt = Instant.parse("2024-01-01T00:00:00Z"),
            updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
        )

        transaction {
            kotlinx.coroutines.runBlocking {
                repository.createProject(project)
                repository.upsertMember(member)
            }
        }

        transaction {
            kotlinx.coroutines.runBlocking {
                val storedProject = repository.getProject("project-1")
                val storedMembers = repository.listMembers("project-1")
                val accessibleProjects = repository.listProjectsForUser("editor-1")

                assertNotNull(storedProject)
                assertEquals("owner-1", storedProject.ownerUserId)
                assertEquals(1, storedMembers.size)
                assertEquals(ProjectRole.EDITOR, storedMembers.single().role)
                assertEquals(listOf("project-1"), accessibleProjects.map { it.id })
            }
        }
    }
}
