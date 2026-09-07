package com.dsbuilder.frontend.feature.init

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectConfigDraft
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.feature.init.application.CreateProjectConfigCommand
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriteResult
import com.dsbuilder.frontend.feature.init.data.LocalProjectConfigWriter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Characterization-тесты на текущее поведение [LocalProjectConfigWriter]: сохраняются перед
 * переносом в отдельный Gradle-модуль `feature-init`.
 */
class LocalProjectConfigWriterTest {
    private fun draftCommand(targetDirectory: String = "/work") = CreateProjectConfigCommand(
        config = ProjectConfigDraft(
            projectId = ProjectId("project-1"),
            designSystemId = DesignSystemId("ds-1"),
            credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        ),
        targetDirectory = targetDirectory,
    )

    @Test
    fun createsConfigWithoutRawSecrets() {
        val fileSystem = InMemoryFileSystem()
        val writer = LocalProjectConfigWriter(ProjectConfigStore(fileSystem))

        val result = writer.create(draftCommand())

        assertIs<ProjectConfigWriteResult.Created>(result)
        assertEquals("/work/.sdds/config.json", result.configPath)

        val written = fileSystem.files.getValue("/work/.sdds/config.json")
        assertTrue(written.contains("project-1"))
        assertTrue(written.contains("ds-1"))
        assertTrue(written.contains("DSBUILDER_API_KEY"))
        assertTrue(written.contains("env"))
    }

    @Test
    fun returnsFailedWhenConfigAlreadyExists() {
        val fileSystem = InMemoryFileSystem()
        fileSystem.files["/work/.sdds/config.json"] = "{}"
        val writer = LocalProjectConfigWriter(ProjectConfigStore(fileSystem))

        val result = writer.create(draftCommand())

        assertIs<ProjectConfigWriteResult.Failed>(result)
        assertEquals("Error: Project config already exists at /work/.sdds/config.json.", result.message)
    }
}
