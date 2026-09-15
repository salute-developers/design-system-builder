package com.dsbuilder.frontend.plugin.androidstudio.projects

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private class FakeProjectsClient(
    private val projects: List<Project>,
) : ProjectsClient {
    override suspend fun listProjects(): List<Project> = projects
}

class ListProjectsUseCaseTest {
    @Test
    fun returnsProjectsFromThePort() = runBlocking<Unit> {
        val projects = listOf(Project(id = "p1", name = "Project One", description = null))
        val useCase = ListProjectsUseCase(FakeProjectsClient(projects))

        assertEquals(projects, useCase.execute())
    }

    @Test
    fun emptyListIsNotAnError() = runBlocking<Unit> {
        val useCase = ListProjectsUseCase(FakeProjectsClient(emptyList()))

        assertTrue(useCase.execute().isEmpty())
    }
}
